"""3-stage LLM Council orchestration."""

from typing import List, Dict, Any, Tuple
from .openrouter import query_models_parallel, query_model
from .config import COUNCIL_MODELS, CHAIRMAN_MODEL


async def stage1_collect_responses(user_query: str) -> List[Dict[str, Any]]:
    """
    Stage 1: Collect individual responses from all council models.

    Args:
        user_query: The user's question

    Returns:
        List of dicts with 'model' and 'response' keys
    """
    messages = [{"role": "user", "content": user_query}]

    # Query all models in parallel
    responses = await query_models_parallel(COUNCIL_MODELS, messages)

    # Format results
    stage1_results = []
    for model, response in responses.items():
        if response is not None:  # Only include successful responses
            stage1_results.append({
                "model": model,
                "response": response.get('content', '')
            })

    return stage1_results


async def stage2_collect_rankings(
    user_query: str,
    stage1_results: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """
    Stage 2: Each model ranks the anonymized responses.

    Args:
        user_query: The original user query
        stage1_results: Results from Stage 1

    Returns:
        Tuple of (rankings list, label_to_model mapping)
    """
    # Create anonymized labels for responses (Response A, Response B, etc.)
    labels = [chr(65 + i) for i in range(len(stage1_results))]  # A, B, C, ...

    # Create mapping from label to model name
    label_to_model = {
        f"Response {label}": result['model']
        for label, result in zip(labels, stage1_results)
    }

    # Build the ranking prompt
    responses_text = "\n\n".join([
        f"Response {label}:\n{result['response']}"
        for label, result in zip(labels, stage1_results)
    ])

    ranking_prompt = f"""You are evaluating different responses to the following question:

Question: {user_query}

Here are the responses from different models (anonymized):

{responses_text}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example of the correct format for your ENTIRE response:

Response A provides good detail on X but misses Y...
Response B is accurate but lacks depth on Z...
Response C offers the most comprehensive answer...

FINAL RANKING:
1. Response C
2. Response A
3. Response B

Now provide your evaluation and ranking:"""

    messages = [{"role": "user", "content": ranking_prompt}]

    # Get rankings from all council models in parallel
    responses = await query_models_parallel(COUNCIL_MODELS, messages)

    # Format results
    stage2_results = []
    for model, response in responses.items():
        if response is not None:
            full_text = response.get('content', '')
            parsed = parse_ranking_from_text(full_text)
            stage2_results.append({
                "model": model,
                "ranking": full_text,
                "parsed_ranking": parsed
            })

    return stage2_results, label_to_model


async def stage3_synthesize_final(
    user_query: str,
    stage1_results: List[Dict[str, Any]],
    stage2_results: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Stage 3: Chairman synthesizes final response.

    Args:
        user_query: The original user query
        stage1_results: Individual model responses from Stage 1
        stage2_results: Rankings from Stage 2

    Returns:
        Dict with 'model' and 'response' keys
    """
    # Build comprehensive context for chairman
    stage1_text = "\n\n".join([
        f"Model: {result['model']}\nResponse: {result['response']}"
        for result in stage1_results
    ])

    stage2_text = "\n\n".join([
        f"Model: {result['model']}\nRanking: {result['ranking']}"
        for result in stage2_results
    ])

    chairman_prompt = f"""You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: {user_query}

STAGE 1 - Individual Responses:
{stage1_text}

STAGE 2 - Peer Rankings:
{stage2_text}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:"""

    messages = [{"role": "user", "content": chairman_prompt}]

    # Query the chairman model
    response = await query_model(CHAIRMAN_MODEL, messages)

    if response is None:
        # Fallback if chairman fails
        return {
            "model": CHAIRMAN_MODEL,
            "response": "Error: Unable to generate final synthesis."
        }

    return {
        "model": CHAIRMAN_MODEL,
        "response": response.get('content', '')
    }


def parse_ranking_from_text(ranking_text: str) -> List[str]:
    """
    Parse the FINAL RANKING section from the model's response.

    Args:
        ranking_text: The full text response from the model

    Returns:
        List of response labels in ranked order
    """
    import re

    # Look for "FINAL RANKING:" section
    if "FINAL RANKING:" in ranking_text:
        # Extract everything after "FINAL RANKING:"
        parts = ranking_text.split("FINAL RANKING:")
        if len(parts) >= 2:
            ranking_section = parts[1]
            # Try to extract numbered list format (e.g., "1. Response A")
            # This pattern looks for: number, period, optional space, "Response X"
            numbered_matches = re.findall(r'\d+\.\s*Response [A-Z]', ranking_section)
            if numbered_matches:
                # Extract just the "Response X" part
                return [re.search(r'Response [A-Z]', m).group() for m in numbered_matches]

            # Fallback: Extract all "Response X" patterns in order
            matches = re.findall(r'Response [A-Z]', ranking_section)
            return matches

    # Fallback: try to find any "Response X" patterns in order
    matches = re.findall(r'Response [A-Z]', ranking_text)
    return matches


def calculate_aggregate_rankings(
    stage2_results: List[Dict[str, Any]],
    label_to_model: Dict[str, str]
) -> List[Dict[str, Any]]:
    """
    Calculate aggregate rankings across all models.

    Args:
        stage2_results: Rankings from each model
        label_to_model: Mapping from anonymous labels to model names

    Returns:
        List of dicts with model name and average rank, sorted best to worst
    """
    from collections import defaultdict

    # Track positions for each model
    model_positions = defaultdict(list)

    for ranking in stage2_results:
        ranking_text = ranking['ranking']

        # Parse the ranking from the structured format
        parsed_ranking = parse_ranking_from_text(ranking_text)

        for position, label in enumerate(parsed_ranking, start=1):
            if label in label_to_model:
                model_name = label_to_model[label]
                model_positions[model_name].append(position)

    # Calculate average position for each model
    aggregate = []
    for model, positions in model_positions.items():
        if positions:
            avg_rank = sum(positions) / len(positions)
            aggregate.append({
                "model": model,
                "average_rank": round(avg_rank, 2),
                "rankings_count": len(positions)
            })

    # Sort by average rank (lower is better)
    aggregate.sort(key=lambda x: x['average_rank'])

    return aggregate


async def generate_conversation_title(user_query: str) -> str:
    """
    Generate a short title for a conversation based on the first user message.

    Args:
        user_query: The first user message

    Returns:
        A short title (3-5 words)
    """
    title_prompt = f"""Generate a very short title (3-5 words maximum) that summarizes the following question.
The title should be concise and descriptive. Do not use quotes or punctuation in the title.

Question: {user_query}

Title:"""

    messages = [{"role": "user", "content": title_prompt}]

    # Use gemini-2.5-flash for title generation (fast and cheap)
    response = await query_model("google/gemini-2.5-flash", messages, timeout=30.0)

    if response is None:
        # Fallback to a generic title
        return "New Conversation"

    title = response.get('content', 'New Conversation').strip()

    # Clean up the title - remove quotes, limit length
    title = title.strip('"\'')

    # Truncate if too long
    if len(title) > 50:
        title = title[:47] + "..."

    return title


async def run_full_council(user_query: str) -> Tuple[List, List, Dict, Dict]:
    """
    Run the complete 3-stage council process (Thinking Mode).

    Args:
        user_query: The user's question

    Returns:
        Tuple of (stage1_results, stage2_results, stage3_result, metadata)
    """
    # Stage 1: Collect individual responses
    stage1_results = await stage1_collect_responses(user_query)

    # If no models responded successfully, return error
    if not stage1_results:
        return [], [], {
            "model": "error",
            "response": "All models failed to respond. Please try again."
        }, {}

    # Stage 2: Collect rankings
    stage2_results, label_to_model = await stage2_collect_rankings(user_query, stage1_results)

    # Calculate aggregate rankings
    aggregate_rankings = calculate_aggregate_rankings(stage2_results, label_to_model)

    # Stage 3: Synthesize final answer
    stage3_result = await stage3_synthesize_final(
        user_query,
        stage1_results,
        stage2_results
    )

    # Prepare metadata
    metadata = {
        "label_to_model": label_to_model,
        "aggregate_rankings": aggregate_rankings
    }

    return stage1_results, stage2_results, stage3_result, metadata


async def wingman_stage1_collect_suggestions(
    user_query: str,
    user_profile: Dict[str, Any]
) -> List[Dict[str, Any]]:
    """
    Wingman Mode Stage 1: Each model provides 5 suggestions as a wingman.

    Args:
        user_query: The user's question/situation
        user_profile: Dict containing gender, race, age, context, etc.

    Returns:
        List of dicts with 'model' and 'suggestions' keys
    """
    profile_items = [
        f"- {key.replace('_', ' ').title()}: {value}"
        for key, value in (user_profile or {}).items()
        if value
    ]
    profile_section = "\n".join(profile_items) if profile_items else "(No specific profile provided - give general advice)"

    wingman_prompt = f"""You are the ultimate wingman - charming, socially intelligent, and attuned to interpersonal dynamics. Your job is to help your friend navigate a social or romantic situation.

USER PROFILE:
{profile_section}

SITUATION:
{user_query}

Your task:
Provide exactly 5 distinct suggestions to help your friend. Each suggestion should be:
- Practical and actionable
- Culturally aware and respectful
- Confident but not arrogant
- Authentic

Format your response EXACTLY like this:
SUGGESTION 1: [Your first suggestion with a brief explanation]
SUGGESTION 2: [Your second suggestion with a brief explanation]
SUGGESTION 3: [Your third suggestion with a brief explanation]
SUGGESTION 4: [Your fourth suggestion with a brief explanation]
SUGGESTION 5: [Your fifth suggestion with a brief explanation]

Be creative, be bold, and most importantly - be a great wingman."""

    messages = [{"role": "user", "content": wingman_prompt}]

    responses = await query_models_parallel(COUNCIL_MODELS, messages)

    stage1_results = []
    for model, response in responses.items():
        if response is not None:
            content = response.get('content', '')
            suggestions = parse_wingman_suggestions(content)
            stage1_results.append({
                "model": model,
                "response": content,
                "suggestions": suggestions
            })

    return stage1_results


def parse_wingman_suggestions(text: str) -> List[str]:
    """
    Parse the 5 suggestions from a wingman model response.

    Args:
        text: The full response text

    Returns:
        List of suggestion strings
    """
    import re

    suggestions = []
    pattern = r'SUGGESTION\s*\d+:\s*(.+?)(?=SUGGESTION\s*\d+:|$)'
    matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)

    for match in matches:
        suggestion = match.strip()
        if suggestion:
            suggestions.append(suggestion)

    if not suggestions:
        lines = text.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line and len(line) > 20:
                numbered = re.match(r'^\d+[\.\)]\s*(.+)', line)
                if numbered:
                    suggestions.append(numbered.group(1))
                elif len(suggestions) < 5:
                    suggestions.append(line)

    return suggestions[:5]


async def wingman_stage2_aggregate(
    user_query: str,
    user_profile: Dict[str, Any],
    stage1_results: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Wingman Mode Stage 2: Chairman aggregates all suggestions and selects top 5.

    Args:
        user_query: The original situation
        user_profile: User's profile information
        stage1_results: All suggestions from Stage 1

    Returns:
        Dict with chairman's top 5 curated suggestions
    """
    profile_items = [
        f"- {key.replace('_', ' ').title()}: {value}"
        for key, value in (user_profile or {}).items()
        if value
    ]
    profile_section = "\n".join(profile_items) if profile_items else "(General advice requested)"

    all_suggestions = []
    for result in stage1_results:
        model_name = result['model'].split('/')[-1]
        suggestions = result.get('suggestions', [])
        if suggestions:
            for suggestion in suggestions:
                all_suggestions.append(f"[From {model_name}]: {suggestion}")
        else:
            response_text = result.get('response', '')
            if response_text:
                all_suggestions.append(f"[From {model_name}]: {response_text[:500]}")

    if not all_suggestions:
        return {
            "model": CHAIRMAN_MODEL,
            "response": "No suggestions were collected from the council. Please try again.",
            "top_5": []
        }

    suggestions_text = "\n\n".join(all_suggestions)

    chairman_prompt = f"""You are the Head Wingman - the most experienced and socially astute member of the wingman council. Multiple AI wingmen have provided suggestions for your friend.

USER PROFILE:
{profile_section}

SITUATION:
{user_query}

ALL SUGGESTIONS FROM THE COUNCIL ({len(all_suggestions)} total):
{suggestions_text}

Your task:
Review all the suggestions above and create the TOP 5 recommendations that would work best for this situation. You can adapt, combine, or improve upon the suggestions.

Provide your response in a clear, friendly format:

**TOP 5 WINGMAN RECOMMENDATIONS:**

**1.** [First recommendation]
*Why this works:* [Brief explanation]

**2.** [Second recommendation]  
*Why this works:* [Brief explanation]

**3.** [Third recommendation]
*Why this works:* [Brief explanation]

**4.** [Fourth recommendation]
*Why this works:* [Brief explanation]

**5.** [Fifth recommendation]
*Why this works:* [Brief explanation]

**BONUS TIP:** [One overall piece of advice for their situation]

Be encouraging and helpful!"""

    messages = [{"role": "user", "content": chairman_prompt}]

    response = await query_model(CHAIRMAN_MODEL, messages)

    if response is None:
        return {
            "model": CHAIRMAN_MODEL,
            "response": "Error: Unable to aggregate suggestions. Please try again.",
            "top_5": []
        }

    content = response.get('content', '')
    
    if not content:
        return {
            "model": CHAIRMAN_MODEL,
            "response": "The chairman did not provide a response. Please try again.",
            "top_5": []
        }

    top_5 = parse_top_5_recommendations(content)

    return {
        "model": CHAIRMAN_MODEL,
        "response": content,
        "top_5": top_5
    }


def parse_top_5_recommendations(text: str) -> List[Dict[str, str]]:
    """
    Parse the top 5 recommendations from chairman's response.

    Args:
        text: The full response text

    Returns:
        List of dicts with 'recommendation' and 'reason' keys
    """
    import re

    recommendations = []
    
    patterns = [
        r'\*\*(\d+)\.\*\*\s*(.+?)\s*\*Why this works:\*\s*(.+?)(?=\*\*\d+\.|BONUS|\*\*BONUS|$)',
        r'(\d+)\.\s*\*\*(.+?)\*\*\s*(?:\n|.)*?(?:Why[:\s]|WHY[:\s])(.+?)(?=\d+\.|BONUS|$)',
        r'(\d+)\.\s*(.+?)(?:WHY:|Why:|Why this works:)\s*(.+?)(?=\d+\.|BONUS|$)',
        r'\*\*(\d+)\.\*\*\s*(.+?)(?=\*\*\d+\.|$)',
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text, re.DOTALL | re.IGNORECASE)
        if matches:
            for match in matches:
                if len(match) >= 3:
                    rec = match[1].strip().strip('*').strip()
                    reason = match[2].strip().strip('*').strip()
                    if rec and reason:
                        recommendations.append({
                            "recommendation": rec,
                            "reason": reason
                        })
                elif len(match) >= 2:
                    rec = match[1].strip().strip('*').strip()
                    if rec:
                        recommendations.append({
                            "recommendation": rec,
                            "reason": ""
                        })
            if recommendations:
                break

    return recommendations[:5]


async def run_wingman_council(
    user_query: str,
    user_profile: Dict[str, Any]
) -> Tuple[List, Dict, Dict]:
    """
    Run the Wingman Mode council process.

    Args:
        user_query: The user's situation
        user_profile: Dict with gender, race, age, context, etc.

    Returns:
        Tuple of (stage1_results, stage2_result, metadata)
    """
    stage1_results = await wingman_stage1_collect_suggestions(user_query, user_profile)

    if not stage1_results:
        return [], {
            "model": "error",
            "response": "All models failed to respond. Please try again.",
            "top_5": []
        }, {}

    stage2_result = await wingman_stage2_aggregate(
        user_query,
        user_profile,
        stage1_results
    )

    total_suggestions = sum(len(r.get('suggestions', [])) for r in stage1_results)
    metadata = {
        "total_suggestions_collected": total_suggestions,
        "models_responded": len(stage1_results),
        "user_profile": user_profile
    }

    return stage1_results, stage2_result, metadata
