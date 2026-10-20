# Learn LangChain + LangGraph with this project

## Layout
```
backend/    FastAPI + LangGraph API (app/, tests/, requirements.txt, .env)
frontend/   React + Vite UI (proxies /api -> localhost:8000)
.venv/      shared Python virtualenv
```

## Run it
```
.venv\Scripts\activate
cd backend
pip install -r requirements.txt
copy .env.example .env        # fill GROQ_API_KEY (free: console.groq.com) and MONGODB_URI
uvicorn app.main:app --reload # open http://localhost:8000/docs
pytest                        # 5 tests, no API key needed (LLM is faked)

# in another terminal
cd frontend && npm run dev    # open http://localhost:5173
```
Run backend commands from inside `backend/`: `.env` and `output/` are resolved relative to it.

1. `POST /analyze` with your PDF + JD -> score, matched (with evidence), missing, experience. Rejected, or paused.
2. `POST /tailor/{thread_id}` with `{"skills": ["docker"]}` (only ones you truly have) -> tailored resume + `/download/{id}` PDF.

## LangChain = the LLM call (app/llm.py)
| Idea | In this project |
|---|---|
| Prompt template | `ChatPromptTemplate.from_messages([...])` with `{variables}` |
| Chat model | `ChatGroq(temperature=0)` (swap provider = change one line) |
| Structured output | `model.with_structured_output(Resume)` -> returns a validated Pydantic object, not text |
| LCEL chain | `prompt \| model` : the `\|` pipes the prompt's output into the model |
| Exercise | add `.with_retry()` to a chain; then add a `StrOutputParser` chain that writes a cover letter |

## LangGraph = the workflow (app/graph.py)
| Idea | In this project |
|---|---|
| State | `State` TypedDict: the shared notebook every node reads/writes |
| Node | a function `state -> partial update` (`parse_resume`, `skill_score`, ...) |
| Edge | `add_edge("a", "b")` always goes a -> b |
| Conditional edge | `route_gate` returns the next node name (pass/fail), `route_guardrail` makes the retry loop |
| Checkpointer | `InMemorySaver` saves state per `thread_id` after each node |
| interrupt / resume | `ask_student` calls `interrupt()`; API later calls `Command(resume=skills)` |
| Exercise | replace `InMemorySaver` with the MongoDB checkpointer so pauses survive a server restart |

Rule of thumb: LangChain = one smart step. LangGraph = many steps with branches, loops and pauses.

## Where accuracy comes from (your demo's selling point)
1. LLM only where language is needed (3 calls). Scoring, dates, gate = deterministic Python, so same input -> same result.
2. `temperature=0` and Pydantic-structured output.
3. Every matched skill shows its evidence line, so users can see why.
4. Guardrail: companies, dates, degrees, skills, and numbers cannot change; on failure it retries once, then forces the facts back.
5. Hash caching in MongoDB: same resume/JD -> identical result, no extra LLM cost.

## Known limits (be upfront in a demo)
- `semantic_threshold` (0.55) and the 60/40 weights are my starting values, not tuned. Collect 10-20 real resume+JD pairs
  you know the answer for, print `score["matched"]` similarities, and adjust in `app/config.py`.
- JD skill extraction quality depends on the LLM; the `ALIASES` map in `scoring.py` should grow as you see misses.
- The checkpointer is in-memory: restart the server and paused sessions are lost.
- I verified everything with tests using a fake LLM. I have NOT run it against real Groq or your Atlas yet; add keys and try it.
