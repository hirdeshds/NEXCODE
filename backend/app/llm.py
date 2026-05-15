import cohere
import os
from dotenv import load_dotenv

load_dotenv()

# Use ClientV2 for modern chat features
co = cohere.ClientV2(api_key=os.getenv("COHERE_API_KEY"))

async def get_cohere_response(prompt: str, feature_type: str):
    """
    Unified function for all NexCode features using Cohere.
    """
    # System prompts based on the documentation's features 
    system_messages = {
        "explain": "You are a senior engineer. Explain the code clearly and concisely.",
        "generate": "You are a code generator. Output ONLY the code block without conversational text.",
        "fix": "You are a debugging expert. Provide the corrected code in a diff-friendly format."
    }

    res = co.chat(
        model="command-r-08-2024", # Native for NexCode pipeline 
        messages=[
            {"role": "system", "content": system_messages.get(feature_type, "")},
            {"role": "user", "content": prompt}
        ]
    )
    return res.message.content[0].text





