import cohere
import os
from dotenv import load_dotenv
import asyncio

load_dotenv()

co = cohere.ClientV2(api_key=os.getenv("COHERE_API_KEY"))

async def get_cohere_response(prompt: str, system_message: str = "You are an expert software engineer."):
    """
    Generic wrapper for Cohere's Chat API to handle generation, 
    fixing, and explanation.
    """
    response = co.chat(
        model="command-r-08-2024",
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3  
    )
    return response.message.content[0].text
if __name__ == "__main__":
    # Example usage
    prompt = "Write a Python function that checks if a number is prime."
    response = asyncio.run(get_cohere_response(prompt))
    print(response)