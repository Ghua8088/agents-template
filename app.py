import os
import sys
import asyncio
import threading
import time

from pytron import App

class AgentBridge:
    def __init__(self, app):
        self.app = app
        self._stream_task = None
        self._stream_loop = None
        
        # NEUTRAL HISTORY API:
        # We maintain chat history here in Python so the frontend stays lightweight.
        # This uses the industry-standard [{"role": "...", "content": "..."}] format.
        self.history = [
            {"role": "system", "content": "You are a helpful assistant."}
        ]

    def stream_ask(self, prompt: str, chat_id: str = None, images: list = None):
        if not prompt: return {"error": "No prompt"}

        def _stream_worker(p):
            try:
                loop = asyncio.new_event_loop()
                self._stream_loop = loop
                asyncio.set_event_loop(loop)

                async def fake_generation():
                    # 1. Store the user's prompt in the backend history
                    self.history.append({"role": "user", "content": p})
                    
                    # 2. [NEUTRAL TOOL CALL INTERCEPTOR]
                    # This is where you would pass `self.history` to your LLM (OpenAI, Langchain, Ollama).
                    # If the LLM returns a tool call (e.g., "get_weather"), you execute it here silently
                    # and append the tool result to `self.history` without ever emitting to the frontend.
                    
                    # 3. Stream the final response to the UI
                    response = f"This is an Echo Bot Template. You said: \n\n> {p}\n\nCheck `app.py` to see how history is managed!"
                    for i in range(0, len(response), 3):
                        self.app.emit('ai_agent_event', {
                            'type': 'token', 
                            'content': response[i:i+3]
                        })
                        await asyncio.sleep(0.02)
                    
                    self.app.emit('ai_agent_event', {
                        'type': 'finish', 
                        'full_reply': response
                    })
                    
                    # 4. Save the final AI response to the backend history
                    self.history.append({"role": "assistant", "content": response})
                
                self._stream_task = loop.create_task(fake_generation())
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

        # Cancel existing stream
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

    def suggest(self, query: str):
        return ["Try asking me anything!", "I am a template Echo Bot."]

    def get_models(self):
        return [{"id": "echo-1", "name": "Echo Bot v1", "size": "1KB"}]

    def change_model(self, model_name):
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

"""
=========================================================
LANGCHAIN & LLAMA-CPP INTEGRATION EXAMPLE
=========================================================
To make this a real AI agent using Langchain and LlamaCpp, 
you can uncomment and adapt the code below inside `_stream_worker()`:

from langchain_community.llms import LlamaCpp
from langchain.callbacks.base import BaseCallbackHandler

class PytronStreamHandler(BaseCallbackHandler):
    def __init__(self, app):
        self.app = app
        
    def on_llm_new_token(self, token: str, **kwargs) -> None:
        self.app.emit('ai_agent_event', {
            'type': 'token', 
            'content': token
        })

async def real_generation(prompt):
    try:
        # 1. Initialize LlamaCpp
        llm = LlamaCpp(
            model_path="./models/your_model.gguf",
            temperature=0.7,
            max_tokens=2000,
            n_ctx=4096,
            top_p=1,
            callbacks=[PytronStreamHandler(self.app)],
            verbose=False,
            streaming=True,
        )
        
        # 2. This automatically streams chunks to the frontend!
        full_response = llm.invoke(prompt)
        
        # 3. Emit finish event
        self.app.emit('ai_agent_event', {
            'type': 'finish', 
            'full_reply': full_response
        })
    except Exception as e:
        self.app.emit('ai_agent_event', {
            'type': 'error', 
            'content': str(e)
        })
"""
