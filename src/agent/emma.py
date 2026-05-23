from agno.agent import Agent
from agno.models.openai import OpenAIChat

from src.agent.tools import get_tools
from src.config import settings


def create_agent(system_prompt: str) -> Agent:
    model = OpenAIChat(id=settings.openai_model, api_key=settings.openai_api_key)
    return Agent(
        name="Emma",
        model=model,
        tools=get_tools(),
        instructions=[system_prompt],
        markdown=False,
    )
