"""Configuration for the LLM Council."""

import os
from enum import Enum
from dotenv import load_dotenv

load_dotenv()

# Council modes
class CouncilMode(str, Enum):
    THINKING = "thinking"
    WINGMAN = "wingman"

# OpenRouter API key
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# Council members - list of OpenRouter model identifiers
COUNCIL_MODELS = [
    "prime-intellect/intellect-3",
    "qwen/qwen3-next-80b-a3b-instruct",
    "google/gemini-3-pro-preview",
    "nvidia/nemotron-3-nano-30b-a3b:free",
    "moonshotai/kimi-k2-thinking",
    "x-ai/grok-4",
    "mistralai/ministral-14b-2512",
    "openai/gpt-5-nano"
]

# Chairman model - synthesizes final response
CHAIRMAN_MODEL = "google/gemini-3-pro-preview"

# OpenRouter API endpoint
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Data directory for conversation storage
DATA_DIR = "data/conversations"
