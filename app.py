import os
import sys
import asyncio
import threading
import time
import keyring
from datetime import datetime

from pytron import App
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

SERVICE_NAME = "LangchainAgentTemplate"
KEY_NAME = "OPENAI_API_KEY"
GEMINI_KEY_NAME = "GEMINI_API_KEY"

# --- Tools ---
@tool
def get_current_time() -> str:
    """Get the current time. Call this when the user asks for the time."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

@tool
def get_weather(location: str) -> str:
    """Get the current weather for a specific location. Call this when the user asks about the weather."""
    # Mock implementation
    return f"The weather in {location} is 72°F and sunny."

@tool
def web_search(query: str) -> str:
    """Search the web for the given query and return a summary of search results. Use this when the user asks about current events, news, or general knowledge that requires searching the internet."""
    try:
        from ddgs import DDGS
        results = list(DDGS().text(query, max_results=5))
        formatted = []
        for r in results:
            formatted.append(f"Title: {r.get('title')}\nURL: {r.get('href')}\nSnippet: {r.get('body')}\n")
        if not formatted:
            return "No results found."
        return "\n".join(formatted)
    except Exception as e:
        return f"Error during search: {str(e)}"

tools = [get_current_time, get_weather, web_search]

# --- App Bridge ---
class AgentBridge:
    def __init__(self, app):
        self.app = app
        self._stream_task = None
        self._stream_loop = None
        self.history = []
        self._system_prompt = (
            "You are a helpful AI assistant. You have access to tools.\n\n"
            "If the user asks a question about current events, news, population, weather, "
            "or any real-time/historical statistics, you MUST use the corresponding tool "
            "(such as `web_search`, `get_weather`, or `get_current_time`) to fetch the answer. "
            "Do not refuse to answer or state that you lack real-time information without first calling the appropriate tool."
        )

    # -- Key Management --
    def get_api_key_status(self):
        try:
            key = keyring.get_password(SERVICE_NAME, KEY_NAME)
        except Exception:
            key = None
        if not key:
            key = self.app.store_get(KEY_NAME, None)
        return {"has_key": bool(key)}

    def set_api_key(self, key: str):
        cleaned_key = key.strip()
        try:
            keyring.set_password(SERVICE_NAME, KEY_NAME, cleaned_key)
        except Exception:
            pass
        self.app.store_set(KEY_NAME, cleaned_key)
        return {"success": True, "message": "API Key saved securely."}

    def get_gemini_api_key_status(self):
        try:
            key = keyring.get_password(SERVICE_NAME, GEMINI_KEY_NAME)
        except Exception:
            key = None
        if not key:
            key = self.app.store_get(GEMINI_KEY_NAME, None)
        return {"has_key": bool(key)}

    def set_gemini_api_key(self, key: str):
        cleaned_key = key.strip()
        try:
            keyring.set_password(SERVICE_NAME, GEMINI_KEY_NAME, cleaned_key)
        except Exception:
            pass
        self.app.store_set(GEMINI_KEY_NAME, cleaned_key)
        return {"success": True, "message": "Gemini API Key saved securely."}

    # -- Agent Execution --
    def stream_ask(self, prompt: str, chat_id: str = None, images: list = None):
        if not prompt: return {"error": "No prompt"}
        
        is_new_chat = False
        if not chat_id:
            import uuid
            chat_id = str(uuid.uuid4())
            is_new_chat = True
            
        if is_new_chat:
            self.history = []
            self.app.emit('ai_agent_event', {
                'type': 'chat_started',
                'chat_id': chat_id
            })
            
        selected_model = self.app.store_get("SELECTED_MODEL", "gpt-4o-mini")
        is_gemini_model = selected_model.startswith("gemini-") or selected_model.startswith("models/gemini-")

        if is_gemini_model:
            try:
                api_key = keyring.get_password(SERVICE_NAME, GEMINI_KEY_NAME)
            except Exception:
                api_key = None
            if not api_key:
                api_key = self.app.store_get(GEMINI_KEY_NAME, None)
        else:
            try:
                api_key = keyring.get_password(SERVICE_NAME, KEY_NAME)
            except Exception:
                api_key = None
            if not api_key:
                api_key = self.app.store_get(KEY_NAME, None)

        api_base_url = self.app.store_get("API_BASE_URL", "https://api.openai.com/v1")
        is_local_provider = api_base_url and "api.openai.com" not in api_base_url
        is_offline_llamacpp = selected_model == "llamacpp"

        def _stream_worker(p):
            try:
                loop = asyncio.new_event_loop()
                self._stream_loop = loop
                asyncio.set_event_loop(loop)

                if not api_key and not is_local_provider and not is_offline_llamacpp:
                    # Run Offline Simulator Mode
                    async def execute_simulation():
                        try:
                            await asyncio.sleep(0.5)
                            p_lower = p.lower()
                            
                            if "time" in p_lower:
                                self.app.emit('ai_agent_event', {
                                    'type': 'tool_start',
                                    'tool': 'get_current_time'
                                })
                                await asyncio.sleep(1.0)
                                
                                res = get_current_time.invoke({})
                                
                                self.app.emit('ai_agent_event', {
                                    'type': 'tool_end',
                                    'tool': 'get_current_time',
                                    'output': res
                                })
                                await asyncio.sleep(0.5)
                                
                                response_text = f"🤖 **Offline Demo Mode**\n\nI used the local `get_current_time` tool. The current time is **{res}**."
                            elif "weather" in p_lower:
                                import re
                                match = re.search(r"weather (?:in|at|for)\s+([a-zA-Z\s]+)", p_lower)
                                location = match.group(1).title() if match else "San Francisco"
                                
                                self.app.emit('ai_agent_event', {
                                    'type': 'tool_start',
                                    'tool': 'get_weather'
                                })
                                await asyncio.sleep(1.2)
                                
                                res = get_weather.invoke({"location": location})
                                
                                self.app.emit('ai_agent_event', {
                                    'type': 'tool_end',
                                    'tool': 'get_weather',
                                    'output': res
                                })
                                await asyncio.sleep(0.5)
                                
                                response_text = f"🤖 **Offline Demo Mode**\n\nI used the local `get_weather` tool. {res}"
                            elif "search" in p_lower or "google" in p_lower or "find" in p_lower:
                                import re
                                match = re.search(r"(?:search|google|find)\s+(?:for|about)?\s*([a-zA-Z0-9\s]+)", p_lower)
                                query = match.group(1).strip() if match else "latest news"
                                
                                self.app.emit('ai_agent_event', {
                                    'type': 'tool_start',
                                    'tool': 'web_search'
                                })
                                await asyncio.sleep(1.5)
                                
                                simulated_output = (
                                    f"Title: {query.title()} - Search Results\n"
                                    f"URL: https://duckduckgo.com/?q={query.replace(' ', '+')}\n"
                                    f"Snippet: This is a simulated search result for '{query}' inside Offline Demo Mode. "
                                    f"To query live web search results, configure an OpenAI/Gemini API key in Settings.\n"
                                )
                                
                                self.app.emit('ai_agent_event', {
                                    'type': 'tool_end',
                                    'tool': 'web_search',
                                    'output': simulated_output
                                })
                                await asyncio.sleep(0.5)
                                
                                response_text = (
                                    f"🤖 **Offline Demo Mode**\n\n"
                                    f"I performed a search for **\"{query}\"** and found the following simulated result:\n\n"
                                    f"{simulated_output}"
                                )
                            else:
                                response_text = (
                                    "🤖 **Offline Demo Mode**\n\n"
                                    "I am running in **Offline Simulator Mode** because no OpenAI API Key has been configured yet.\n\n"
                                    "### Available Capabilities:\n"
                                    "1. **Get current time**: Try asking me *\"What time is it?\"*\n"
                                    "2. **Check weather**: Try asking me *\"What's the weather in Seattle?\"*\n"
                                    "3. **Web Search**: Try asking me *\"Search the web for SpaceX\"*\n\n"
                                    "To use a real GPT-4o agent, click on the **Settings** button in the sidebar and enter your `OPENAI_API_KEY`."
                                )
                            
                            words = response_text.split(" ")
                            for i in range(0, len(words), 2):
                                chunk = " ".join(words[i:i+2]) + " "
                                self.app.emit('ai_agent_event', {
                                    'type': 'token', 
                                    'content': chunk
                                })
                                await asyncio.sleep(0.08)
                                
                            self.app.emit('ai_agent_event', {
                                'type': 'finish', 
                                'full_reply': response_text
                            })
                            
                            self.history.append(("user", p))
                            self.history.append(("assistant", response_text))
                            self._persist_chat(chat_id, p, response_text)
                            
                        except Exception as ex:
                            self.app.emit('ai_agent_event', {
                                'type': 'error', 
                                'content': f"Simulation error: {str(ex)}"
                            })
                    
                    self._stream_task = loop.create_task(execute_simulation())
                    loop.run_until_complete(self._stream_task)
                    return

                # Real mode
                effective_api_key = api_key if api_key else "not-needed"
                if is_gemini_model:
                    os.environ["GEMINI_API_KEY"] = effective_api_key
                else:
                    os.environ["OPENAI_API_KEY"] = effective_api_key

                async def execute_agent():
                    try:
                        # 1. Initialize LangGraph Agent
                        if selected_model == "llamacpp":
                            from langchain_community.chat_models import ChatLlamaCpp
                            
                            model_path = self.app.store_get("LOCAL_MODEL_PATH", "")
                            if not model_path or not os.path.exists(model_path):
                                self.app.emit('ai_agent_event', {
                                    'type': 'error',
                                    'content': "Missing GGUF model file. Please click 'Settings' in the sidebar and select a valid .gguf model file."
                                })
                                return
                            model = ChatLlamaCpp(
                                model_path=model_path,
                                n_ctx=2048,
                                temperature=0,
                                verbose=False
                            )
                        elif is_gemini_model:
                            from langchain_google_genai import ChatGoogleGenerativeAI
                            
                            model = ChatGoogleGenerativeAI(
                                model=selected_model,
                                google_api_key=effective_api_key,
                                temperature=0
                            )
                        else:
                            model_name = selected_model
                            if model_name == "custom":
                                model_name = self.app.store_get("CUSTOM_MODEL_NAME", "llama3")

                            model = ChatOpenAI(
                                model=model_name, 
                                base_url=api_base_url, 
                                api_key=effective_api_key,
                                temperature=0
                            )
                        agent = create_react_agent(model, tools, prompt=self._system_prompt)
                        
                        # 2. Setup inputs
                        inputs = {"messages": self.history + [("user", p)]}
                        
                        # 3. Stream execution
                        full_response = ""
                        async for event in agent.astream_events(inputs, version="v2"):
                            kind = event["event"]
                            
                            if kind == "on_chat_model_stream":
                                chunk = event["data"]["chunk"]
                                if chunk.content:
                                    # If it's a list (content blocks), extract text
                                    if isinstance(chunk.content, list):
                                        text = "".join([b.get("text", "") for b in chunk.content if isinstance(b, dict)])
                                    else:
                                        text = chunk.content
                                        
                                    if text:
                                        full_response += text
                                        self.app.emit('ai_agent_event', {
                                            'type': 'token', 
                                            'content': text
                                        })
                            
                            elif kind == "on_tool_start":
                                tool_name = event["name"]
                                self.app.emit('ai_agent_event', {
                                    'type': 'tool_start',
                                    'tool': tool_name
                                })
                                
                            elif kind == "on_tool_end":
                                tool_name = event["name"]
                                tool_output = event["data"].get("output")
                                if hasattr(tool_output, "content"):
                                    tool_output = tool_output.content
                                self.app.emit('ai_agent_event', {
                                    'type': 'tool_end',
                                    'tool': tool_name,
                                    'output': str(tool_output)
                                })

                        # Finish response
                        self.app.emit('ai_agent_event', {
                            'type': 'finish', 
                            'full_reply': full_response
                        })
                        
                        # Update history
                        self.history.append(("user", p))
                        self.history.append(("assistant", full_response))
                        self._persist_chat(chat_id, p, full_response)

                    except Exception as ex:
                        self.app.emit('ai_agent_event', {
                            'type': 'error', 
                            'content': f"LangGraph execution error: {str(ex)}"
                        })
                
                self._stream_task = loop.create_task(execute_agent())
                loop.run_until_complete(self._stream_task)
            except asyncio.CancelledError:
                print("Stream cancelled")
            except Exception as e:
                self.app.emit('ai_agent_event', {
                    'type': 'error', 
                    'content': str(e)
                })
            finally:
                self._stream_task = None
                self._stream_loop = None

        self.stop_generation()

        t = threading.Thread(target=_stream_worker, args=(prompt,), daemon=True)
        t.start()
        return {"ok": True}

    def stop_generation(self):
        try:
            if self._stream_loop and self._stream_task:
                self._stream_loop.call_soon_threadsafe(self._stream_task.cancel)
            return {"stopped": True}
        except Exception:
            return {"stopped": False}

    def clear_history(self):
        self.history = []
        return {"success": True}

    def list_chats(self):
        return self.app.store_get("CHAT_LIST", [])
        
    def load_chat(self, chat_id: str):
        messages = self.app.store_get(f"CHAT_{chat_id}", [])
        self.history = []
        for msg in messages:
            role = msg.get("role")
            content = msg.get("content")
            if role in ("user", "assistant") and content:
                self.history.append((role, content))
        return messages
        
    def delete_chat(self, chat_id: str):
        try:
            chats = self.app.store_get("CHAT_LIST", [])
            chats = [c for c in chats if c.get("id") != chat_id]
            self.app.store_set("CHAT_LIST", chats)
            self.app.store_set(f"CHAT_{chat_id}", None)
            self.app.emit('ai_agent_event', {
                'type': 'chat_list_updated',
                'chats': chats
            })
            return {"success": True, "chats": chats}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _persist_chat(self, chat_id: str, prompt: str, response: str):
        try:
            messages = self.app.store_get(f"CHAT_{chat_id}", [])
            messages.append({"role": "user", "content": prompt})
            messages.append({"role": "assistant", "content": response})
            self.app.store_set(f"CHAT_{chat_id}", messages)
            
            chats = self.app.store_get("CHAT_LIST", [])
            chat_meta = None
            for c in chats:
                if c.get("id") == chat_id:
                    chat_meta = c
                    break
            if not chat_meta:
                title = prompt[:30] + "..." if len(prompt) > 30 else prompt
                chat_meta = {
                    "id": chat_id,
                    "title": title,
                    "created_at": datetime.now().isoformat()
                }
                chats.insert(0, chat_meta)
            chat_meta["updated_at"] = datetime.now().isoformat()
            chats.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
            self.app.store_set("CHAT_LIST", chats)
            self.app.emit('ai_agent_event', {
                'type': 'chat_list_updated',
                'chats': chats
            })
        except Exception as e:
            print(f"Error persisting chat: {e}")

    def suggest(self, query: str):
        return ["What is the current time?", "What's the weather in San Francisco?"]

    def get_models(self):
        models = [
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "size": "Cloud"},
            {"id": "gpt-4o", "name": "GPT-4o", "size": "Cloud"},
            {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "size": "Cloud"},
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "size": "Cloud"},
            {"id": "gemini-1.5-flash", "name": "Gemini 1.5 Flash", "size": "Cloud"},
            {"id": "gemini-1.5-pro", "name": "Gemini 1.5 Pro", "size": "Cloud"}
        ]
        
        special_models = [
            {"id": "custom", "name": "Custom / Local Model (API)", "size": "Local/Cloud"},
            {"id": "llamacpp", "name": "Local GGUF Model (LlamaCpp)", "size": "Local"}
        ]
        
        try:
            openai_key = keyring.get_password(SERVICE_NAME, KEY_NAME)
        except Exception:
            openai_key = None
        if not openai_key:
            openai_key = self.app.store_get(KEY_NAME, None)
            
        try:
            gemini_key = keyring.get_password(SERVICE_NAME, GEMINI_KEY_NAME)
        except Exception:
            gemini_key = None
        if not gemini_key:
            gemini_key = self.app.store_get(GEMINI_KEY_NAME, None)
            
        api_base_url = self.app.store_get("API_BASE_URL", "https://api.openai.com/v1")
        is_local_provider = api_base_url and "api.openai.com" not in api_base_url
        
        seen_ids = {m["id"] for m in models}
        
        # Fetch OpenAI (or Local OpenAI-compatible) models
        if openai_key or is_local_provider:
            try:
                from openai import OpenAI
                client = OpenAI(
                    api_key=openai_key or "mock-key",
                    base_url=api_base_url,
                    timeout=5.0
                )
                openai_models = client.models.list()
                for model in openai_models:
                    model_id = model.id
                    # Simple filter to skip non-chat models
                    skip_substrings = ["whisper", "tts", "dall-e", "embedding", "moderation", "babbage", "davinci", "canary", "edit"]
                    if any(sub in model_id.lower() for sub in skip_substrings):
                        continue
                    if model_id not in seen_ids:
                        seen_ids.add(model_id)
                        models.append({
                            "id": model_id,
                            "name": model_id,
                            "size": "Local" if is_local_provider else "Cloud"
                        })
            except Exception as e:
                print(f"Error fetching OpenAI models: {e}")
                
        # Fetch Gemini models
        if gemini_key:
            try:
                from google import genai
                client = genai.Client(api_key=gemini_key)
                gemini_models = client.models.list()
                for model in gemini_models:
                    full_name = model.name or ""
                    model_id = full_name.replace("models/", "") if full_name.startswith("models/") else full_name
                    if not model_id:
                        continue
                    
                    # Check supported actions if present
                    supported = getattr(model, "supported_actions", []) or []
                    if "generateContent" not in supported and "gemini" not in model_id.lower():
                        continue
                        
                    if model_id not in seen_ids:
                        seen_ids.add(model_id)
                        models.append({
                            "id": model_id,
                            "name": model.display_name or model_id,
                            "size": "Cloud"
                        })
            except Exception as e:
                print(f"Error fetching Gemini models: {e}")
                
        for sm in special_models:
            if sm["id"] not in seen_ids:
                models.append(sm)
                
        return models

    def change_model(self, model_name):
        self.app.store_set("SELECTED_MODEL", model_name)
        return {"success": True, "message": f"Switched to {model_name}"}

def main():
    app = App()
    
    bridge = AgentBridge(app)
    app.register_protocol("AgenticTemplate")
    app.expose(bridge)    
    app.generate_types()
    app.run()

if __name__ == '__main__':
    main()
