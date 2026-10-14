const assistantPart2 = {
  "officeConnectors": {
    "statusConnected": "Connected",
    "statusError": "Error",
    "statusConfigured": "Configured",
    "statusDisconnected": "Disconnected",
    "connectFailed": "Failed to connect",
    "disconnectFailed": "Failed to disconnect",
    "managerTitle": "Connect office tools",
    "close": "Close",
    "managerHint": "When you connect a tool, a button appears in the chat (next to attach) to search and attach its files.",
    "howToConfigure": "How to configure {name}",
    "reconfigure": "Reconfigure",
    "disconnect": "Disconnect",
    "connect": "Connect",
    "requiredMark": " *",
    "cancel": "Cancel",
    "connecting": "Connecting…",
    "saveAndConnect": "Save and connect",
    "loadFilesFailed": "Failed to load files",
    "attachFailed": "Failed to attach file",
    "searchPlaceholder": "Search in {name}…",
    "search": "Search",
    "loading": "Loading…",
    "noResults": "No results.",
    "openFolder": "Open folder",
    "attachToChat": "Attach to chat"
  },
  "cliUsageBars": {
    "sourceReal": "account quota remaining",
    "sourceEstimated": "estimated tokens remaining",
    "sourceTokens": "tokens remaining",
    "cliUsage": "CLI available",
    "session5h": "Session (5h)",
    "week": "Week",
    "sessionHours": "Session ({hours}h)",
    "resetSameDay": "resets {time}",
    "resetOtherDay": "resets {day}, {time}",
    "unavailable": "Couldn't load {provider} quota",
    "retry": "Retry"
  },
  "notifySettings": {
    "title": "Assistant notifications",
    "description": "Notify me on my devices (web, app and desktop) when a chat ends and I'm not watching it.",
    "saveError": "Could not save."
  },
  "voiceSettings": {
    "title": "Voice (audio)",
    "description": "Talk to the assistant (your speech is transcribed to text) and hear its responses out loud. Uses the OpenAI or Gemini API key you already have configured.",
    "missingCapabilities": "Configure an OpenAI (transcription + voice) or Gemini (transcription only) API key in the provider cards to enable audio.",
    "inputLabel": "Input (STT)",
    "outputLabel": "Output (TTS)",
    "notAvailable": "not available",
    "voiceLabel": "Voice",
    "autoSpeak": "Read responses aloud automatically when finished",
    "audioProvider": "Audio provider",
    "providerApi": "API (OpenAI/Gemini)",
    "providerPiper": "Piper (local)",
    "providerMinimax": "MiniMax",
    "providerApiHint": "Uses the provider API key you already configured.",
    "piperReady": "Piper installed",
    "piperMissing": "Piper not installed",
    "minimaxReady": "MiniMax ready",
    "minimaxMissing": "MiniMax unavailable",
    "minimaxAuthMissing": "MiniMax key missing",
    "minimaxVoiceHint": "MiniMax voice to use."
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "New team",
      "newTeamTitle": "Create team",
      "editTeamTitle": "Edit team",
      "nameLabel": "Name",
      "namePlaceholder": "E.g. Backend, Frontend, Design…",
      "descriptionLabel": "Description (optional)",
      "colorLabel": "Color",
      "createBtn": "Create team",
      "saveBtn": "Save",
      "cancelBtn": "Cancel",
      "addAgentsBtn": "Add agents",
      "addAgentsTitle": "Add agents to team",
      "addAgentsEmpty": "No agents available to add.",
      "addAgentsConfirm": "Add",
      "alreadyInTeam": "in another team",
      "removeFromTeamBtn": "Remove from team",
      "removeFromTeamConfirm": "Remove this agent from the team? The agent is not deleted.",
      "deleteTeamBtn": "Delete team",
      "deleteTeamConfirm": "Delete this team?",
      "deleteTeamKeepsAgentsNote": "Agents are NOT deleted: they're only removed from the team.",
      "teamSelectorLabel": "Team",
      "groupRequired": "Select or create a group",
      "teamSelectorPlaceholder": "— Select a group —",
      "noTeamOption": "No team",
      "emptyTeamHint": "Empty team — add agents with the + button.",
      "memberCount": "{count} member(s)"
    },
    "cancel": "Cancel",
    "saving": "Saving…",
    "saveChanges": "Save changes",
    "noDescription": "No description",
    "allTools": "all tools",
    "toolsCount": "{count} tools",
    "noActiveModules": "No active modules with tools.",
    "removeAll": "Remove all",
    "selectAll": "Select all",
    "sensitiveTool": "sensitive action",
    "confirmDeleteAgent": "Delete agent \"{name}\"?",
    "confirmDeleteRole": "Delete role \"{name}\"? It will be removed from all agents using it.",
    "duplicateName": "{name} (copy)",
    "editBtn": "Edit",
    "deleteTitle": "Delete",
    "errorPrefix": "Error: {message}",
    "backToAgents": "Agents",
    "createdBy": "Created by {ownerName}",
    "diagram": {
      "empty": "No agents — create one to see it here",
      "connection": "connection"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "Security auditor",
      "dba": "Database administrator",
      "support": "Technical support",
      "nginx": "Web / Nginx administrator",
      "backups": "Backup specialist",
      "logs": "Log analyst",
      "automation": "Automation / Cron"
    },
    "editor": {
      "titleNew": "New agent",
      "titleEdit": "Edit agent",
      "headerTitleNew": "New agent",
      "headerDescNew": "Set up a new AI agent",
      "headerTitleEdit": "Editing agent",
      "headerDescEdit": "Change the agent's configuration",
      "backToList": "Back to agents",
      "tabGeneral": "General",
      "tabModel": "Model",
      "tabHierarchy": "Hierarchy",
      "tabTools": "Tools",
      "tabResources": "Resources",
      "tabAccess": "Access",
      "aiHelpTitle": "AI assist",
      "aiHelpDesc": "Choose a profile and the AI will draft the name, description, prompt, and tools professionally.",
      "aiHelpSelect": "Select a profile…",
      "aiHelpFromDesc": "From my description",
      "aiHelpFromDescTitle": "Improve from current description",
      "aiHelpGenerating": "Generating agent with AI…",
      "fieldName": "Name",
      "namePlaceholder": "E.g. Security auditor",
      "fieldDescription": "Description",
      "descPlaceholder": "What this agent is for",
      "fieldSystemPrompt": "System prompt",
      "systemPromptPlaceholder": "Agent instructions, personality, and goals…",
      "fieldAvatar": "Avatar",
      "avatarRandomize": "Random",
      "avatarAuto": "Auto",
      "avatarAttrs": {
        "top": "Hair / hat",
        "hairColor": "Hair color",
        "eyes": "Eyes",
        "eyebrows": "Eyebrows",
        "mouth": "Mouth",
        "skinColor": "Skin color",
        "clothing": "Clothes",
        "clothesColor": "Clothes color",
        "accessories": "Accessory",
        "facialHair": "Facial hair",
        "facialHairColor": "Facial hair color"
      },
      "fieldProvider": "Provider",
      "fieldModel": "Model",
      "modelPlaceholder": "(provider default)",
      "realtimeLabel": "Real-time communication (low-latency session)",
      "realtimeDesc": "Bidirectional streaming audio/text session (provider-dependent: OpenAI Realtime or Gemini Live).",
      "realtimeUnavailable": "Provider \"{providerId}\" does not support real-time sessions. Available only with codex (OpenAI) or gemini.",
      "multiAgentLabel": "Multi-agent mode: run multiple parallel copies of this agent",
      "multiAgentDescPre": "The agent is ",
      "multiAgentDescBold": "multiplied by X",
      "multiAgentDescPost": ": the task is split into X parts and each copy (same prompt, tools, and provider) solves one in parallel; then a single response is synthesized.",
      "multiAgentCopies": "Number of copies (X)",
      "multiAgentCopiesHint": "agent copies (2–8)",
      "multiAgentProvidersPre": "Optional — distribute copies across multiple providers (the primary one ",
      "multiAgentProvidersPost": " always participates; check others to distribute copies):",
      "multiAgentApiHint": "Only providers in API mode with an API key are used. Multi-agent requires API mode.",
      "roleHeading": "Role & hierarchy",
      "roleAssigned": "Assigned role",
      "roleNone": "No role",
      "roleHint": "The role provides a base prompt and default tools; the agent refines it. Manage roles from the agent list.",
      "parentAgent": "Parent agent (subordination)",
      "parentNone": "None (top level)",
      "parentHintPre": "Its parent will be able to ",
      "parentHintBold": "delegate to it",
      "parentHintPost": " tasks during execution and use its response.",
      "connectionsLabel": "Connections with other agents",
      "connectionsEmpty": "No other agents.",
      "connectionsHint": "Bidirectional channel: either agent can request or share information with the other at runtime (delegation tool).",
      "supervisorLabel": "Supervisor: can create chats for its subordinates",
      "supervisorDesc": "Opens real chats in the Chat tab and assigns work to subordinates (each chat becomes that agent's log). Also granted via the role.",
      "allowAllTools": "Allow all available tools",
      "toolsDesc": "Select the subset of tools this agent can use. The list is intersected with what each module allows, so it never expands permissions.",
      "associatedServers": "Associated servers",
      "serversEmpty": "No registered servers.",
      "attachedProjects": "Attached projects",
      "attachedProjectsDesc": "Select one or more projects from the tree. Checking a parent project selects all its nested folders; the agent uses the work paths of the selected projects.",
      "noParentProjects": "No projects.",
      "graphIndexesTitle": "Code graph indexes",
      "graphIndexesDesc": "The agent will use these indexes to explore the code through the graph (symbols, calls and architecture) instead of reading whole files — reducing token usage.",
      "graphIndexesEmpty": "No graph indexes available. Index a project from the Projects tab.",
      "credentialTitle": "Access credentials",
      "saveObsidian": "Save summaries to the attached project's Obsidian vault",
      "agentSkills": "Agent skills",
      "createAgent": "Create agent",
      "snippetsSection": "Terminal snippets",
      "snippetsCategoryLabel": "Snippets category",
      "snippetsCategoryNone": "(none)",
      "snippetsTagsLabel": "Category tags",
      "snippetsHelp": "Pre-filters the terminal snippets available to this agent: pick a category and, optionally, tags from that category. No category = no filter.",
      "snippetsNoAccess": "Could not load terminal snippets (requires terminal permission).",
      "snippetsNoTags": "This category has no tags."
    },
    "roleEditor": {
      "titleNew": "New role",
      "titleEdit": "Edit role",
      "fieldName": "Role name",
      "namePlaceholder": "E.g. Coordinator, Auditor, DB Specialist",
      "fieldDesc": "Description",
      "descPlaceholder": "What this role represents",
      "fieldBasePrompt": "Role base prompt",
      "basePromptPlaceholder": "Policies, responsibilities, and tone common to all agents with this role…",
      "basePromptHint": "Injected as the base, before the agent's own prompt.",
      "noToolLimit": "No tool restriction from the role",
      "toolsDesc": "The role's tools limit what its agents can access (intersected, never expanded).",
      "supervisorLabel": "Supervisor role: agents with this role can create chats for their subordinates",
      "supervisorDesc": "Grants permission to act as a supervisor (tool to open chats and assign work) to every agent with this role.",
      "createRole": "Create role"
    },
    "treeView": {
      "title": "Agent hierarchy",
      "reloadTitle": "Reload agents and regenerate the tree",
      "regenerating": "Regenerating…",
      "regenerate": "Regenerate",
      "description": "Subordination tree diagram (solid line = parent → subordinate) and peer connections (dashed line). Assign the «Parent agent» in each agent's editor to build the tree."
    },
    "rolesList": {
      "newRole": "New role",
      "description": "Reusable roles (profile with base prompt and tools) that you assign to one or more agents.",
      "emptyTitle": "No roles yet",
      "emptyDesc": "Create a role to standardize the behavior of multiple agents.",
      "agentsCount": "{count} agent(s)"
    },
    "list": {
      "description": "Custom AI agents: own prompt, tools, and provider/model. Use them in chat or schedule them in Cron.",
      "treeBtn": "Tree",
      "treeBtnTitle": "View the agent hierarchy tree",
      "rolesBtn": "Roles",
      "rolesBtnTitle": "Create and manage agent roles",
      "newAgent": "New agent",
      "loading": "Loading agents…",
      "emptyTitle": "No agents yet",
      "emptyDesc": "Create one to chat with a custom prompt and tool set.",
      "multiAgentTitle": "Multi-agent: {count} copies",
      "roleAssignedTitle": "Assigned role",
      "subordinateTitle": "Subordinate of",
      "connectionsTitle": "Connections with other agents",
      "supervisorTitle": "Supervisor: can create chats for subordinates",
      "supervisorBadge": "supervisor",
      "realtimeTitle": "Real-time communication",
      "realtimeBadge": "real-time",
      "startChat": "Start chat",
      "duplicateTitle": "Duplicate",
      "noRoleGroupTitle": "Unassigned work group",
      "groupAria": "Work group: {name}",
      "groupCount": "{count} agents",
      "noRoleGroupDesc": "Agents without an assigned role. Assign one from each agent's editor."
    },
    "resync": {
      "btn": "Sync with template",
      "btnTitle": "Compare this team with its template and create any missing agents",
      "modalTitle": "Sync «{name}» with its template",
      "loading": "Comparing with the template…",
      "markersMissing": "This team has lost its template origin markers, so it cannot be compared automatically. You can create any missing agents manually.",
      "missingHeading": "Missing",
      "presentHeading": "Present",
      "extraHeading": "Added manually",
      "extraNote": "These will not be changed.",
      "nothingMissing": "The team is complete: no agents are missing from the template.",
      "confirm": "Create selected",
      "applying": "Creating…",
      "close": "Close"
    }
  },
  "accessTab": {
    "all": "All",
    "permissionsTitle": "Access and permissions",
    "permissionsDescription": "Today the assistant's visibility is governed by the assistant module permission in your profile. Per-role detail (assistant.use / assistant.configure / assistant.module.<id>) is planned for the next iteration.",
    "recentInvocations": "Recent tool invocations",
    "refreshAriaLabel": "Refresh access",
    "loading": "Loading...",
    "emptyRecent": "No recent activity.",
    "emptyProvider": "No activity for this provider.",
    "byUser": "by",
    "crossServerTitle": "Access to associated server",
    "autoApproveTitle": "Automatic approval",
    "autoApproveDescription": "Tools that no longer ask for confirmation (approved with \"Approve and don't ask again\"). Changes apply from the next run.",
    "autoApproveEmpty": "No tools with automatic approval. This list fills when you choose \"Approve and don't ask again\" when approving an agent action.",
    "autoApproveRevoke": "Revoke",
    "autoApproveModeAuto": "auto mode: this list does not apply",
    "cmdPrefix": "$ ",
    "passwordLabel": "password: ",
    "passphraseLabel": "passphrase: ",
    "privateKeyLabel": "private key"
  },
  "directoryPicker": {
    "title": "Select folder",
    "goUp": "Go up",
    "loading": "Loading…",
    "emptyDirs": "(no subdirectories)",
    "cancel": "Cancel",
    "select": "Use this folder",
    "readError": "Could not read the directory"
  },
  "skillsSettings": {
    "title": "Assistant skills and methods",
    "helper": "Enable or disable libraries, skills and methods that fine-tune the assistant's behavior.",
    "tokenNote": "Each skill's instructions travel in the cached prompt (~0.1× on subsequent turns). Ponytail reduces code and output tokens; in UI/UX Pro Max use the «Brief» level to spend less.",
    "search": "Search skill…",
    "allCategories": "All categories",
    "loading": "Loading skills...",
    "empty": "No skills available.",
    "noMatch": "No skill matches the filter.",
    "sourcePrefix": "Source:",
    "errorGeneric": "Could not update the skill. Try again.",
    "activeShown": "{count} active · {shown} shown."
  },
  "skillsPicker": {
    "searchPlaceholder": "Search skill…",
    "resetTitle": "Remove customization (use global skills)",
    "reset": "Reset ({count})",
    "loading": "Loading skills…",
    "empty": "No skills.",
    "globalNote": "Applied ONLY in their chats, on top of the provider's global skills."
  },
  "skillCategories": {
    "methods": "Assistant methods",
    "code-quality": "Code quality",
    "web-quality": "Web quality (Lighthouse / CWV)",
    "ui-ux": "UI / UX / design",
    "web-fullstack": "Web / full-stack AI development",
    "mobile": "Mobile apps",
    "code-agents": "Code agents",
    "reusable-skills": "Reusable AI skills",
    "security": "AI / web / app security",
    "token-savings": "Token savings / AI costs",
    "ai-prod": "AI agents in production",
    "devops": "DevOps / deployment",
    "testing": "Testing / code quality",
    "data-rag": "Databases / RAG / search",
    "automation": "Automation / workflows",
    "other": "Other"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "Ask before deciding",
      "description": "Lets the assistant stop and ask you a key decision instead of assuming (lxp_ask tool + question protocol)."
    },
    "project-context-vault": {
      "name": "Project context (Obsidian)",
      "description": "Injects project context notes (Contexto.md / Errores.md) and lets you search for more with obsidian.search_notes."
    },
    "ponytail": {
      "name": "Ponytail (minimalist code)",
      "description": "Minimalist development mode: write the minimum code needed (decision ladder + guardrails)."
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max (interface quality)",
      "description": "Professional UI/UX standards (accessibility, touch, typography, states) injected into the prompt; brief or full level."
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "OpenAI agents with tools, handoffs, guardrails, sessions and tracing."
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "Python SDK for agents: Agent, Runner, @function_tool, handoffs and tracing."
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "TypeScript/JS SDK for OpenAI agents: Agent, run, tools (Zod), handoffs."
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "Open standard (the 'USB-C of AI') to connect LLMs to tools, resources and prompts."
    },
    "mcp-github": {
      "name": "MCP (GitHub)",
      "description": "MCP GitHub org: official SDKs (10 languages), reference servers and inspector."
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP Intro",
      "description": "Anthropic announcement: MCP as an open standard that solves N×M integrations."
    },
    "n8n": {
      "name": "n8n",
      "description": "Fair-code, self-hostable workflow automation."
    },
    "make": {
      "name": "Make",
      "description": "Visual no-code automation by scenarios (formerly Integromat)."
    },
    "zapier": {
      "name": "Zapier",
      "description": "SaaS automation via triggers and actions (Zaps)."
    },
    "temporal": {
      "name": "Temporal",
      "description": "Orchestration of durable, fault-tolerant workflows."
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "Redis-backed job queues for Node.js."
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "Orchestration of LLM agents as stateful graphs."
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "Guides the agent to use OpenAI's Codex CLI (terminal code agent)."
    },
    "codex-cli-features": {
      "name": "Codex CLI Features",
      "description": "Details the agent on Codex CLI capabilities (sandbox, approvals, MCP, config)."
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "Guides the agent to delegate tasks to Codex Cloud (remote environments, parallel execution, PRs)."
    },
    "claude-code-skills": {
      "name": "Claude Code Skills",
      "description": "Guides the agent to create and use Claude Code Skills (folder with SKILL.md, Agent Skills standard)."
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot Cloud Agent",
      "description": "Guides the agent to delegate issues to the GitHub Copilot coding agent, which works in the cloud and opens PRs."
    },
    "cursor": {
      "name": "Cursor",
      "description": "Guides the agent to work in the Cursor editor (Agent, repo context, rules)."
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "Guides the agent to write and follow AGENTS.md, the standard instruction file for code agents."
    },
    "open-design-contribute": {
      "name": "Open Design — contribute (no-code)",
      "description": "Guided no-code flow to contribute to Open Design (nexu-io): submit a Skill or Design System, translate docs, fix copy or report a bug, and it opens the PR/issue for you."
    },
    "supabase": {
      "name": "Supabase",
      "description": "Managed Postgres backend with auth, storage and realtime."
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "Robust relational database with rich types."
    },
    "pgvector": {
      "name": "pgvector",
      "description": "Vector similarity search inside Postgres."
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "Managed vector database for RAG at scale."
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "Open-source vector engine with payload filtering."
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "Vector database with schema and vectorization modules."
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "CI/CD on GitHub with YAML workflows (.github/workflows) triggered by events."
    },
    "vercel": {
      "name": "Vercel",
      "description": "Deployment of frontends and serverless functions with per-commit/PR preview."
    },
    "docker": {
      "name": "Docker",
      "description": "Packages apps into ephemeral containers with lightweight, reproducible images."
    },
    "nginx": {
      "name": "Nginx",
      "description": "High-performance web server and reverse proxy."
    },
    "pm2": {
      "name": "PM2",
      "description": "Node process manager with cluster, restart and logs."
    },
    "redis": {
      "name": "Redis",
      "description": "In-memory store for caching, queues and data structures."
    },
    "expo": {
      "name": "Expo",
      "description": "Guides the agent to develop React Native apps with Expo (expo-router, modules, config plugins)."
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "Guides the agent to build iOS/Android binaries in the cloud with EAS Build and eas.json profiles."
    },
    "eas-services": {
      "name": "EAS Services",
      "description": "Helps the agent use the EAS ecosystem (Submit, Update/OTA, Workflows) end-to-end."
    },
    "react-native": {
      "name": "React Native",
      "description": "Guides the agent to build native UIs with React Native (core components, styles, platform)."
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "Guides the agent to implement authentication with Firebase Auth (providers, tokens, session)."
    },
    "claude-agent-skills": {
      "name": "Claude Agent Skills",
      "description": "Packages reusable capabilities as Agent Skills (SKILL.md) loaded on demand."
    },
    "claude-skills-github": {
      "name": "Claude Skills (GitHub)",
      "description": "Official anthropics/skills repository: examples, spec and template as a base and pattern."
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md Guide",
      "description": "Codex's AGENTS.md convention for giving project instructions to code agents."
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "Top 10 risks in LLM apps: prompt injection, insecure output, excessive agency."
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0: standard of verifiable security requirements by levels."
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL: query code as data (data-flow/taint) to find vulnerabilities."
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep: code-like rule SAST + Supply Chain (SCA) and Secrets, high signal."
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk: SCA, Code (SAST), Container, IaC and API/Web (DAST) with guided remediation."
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP: leading open source web scanner for DAST (passive/active scan)."
    },
    "skillspector": {
      "name": "SkillSpector (audit AI Skills)",
      "description": "Audits AI agent Skills (SKILL.md + scripts) for vulnerabilities and malicious intent before installing them (NVIDIA, Apache-2.0)."
    },
    "playwright": {
      "name": "Playwright",
      "description": "Cross-browser E2E testing with auto-waiting and traces."
    },
    "cypress": {
      "name": "Cypress",
      "description": "Component and E2E testing in the browser with retries."
    },
    "vitest": {
      "name": "Vitest",
      "description": "Fast test runner native to Vite/ESM."
    },
    "jest": {
      "name": "Jest",
      "description": "Testing framework with built-in mocks and snapshots."
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "User-centric queries to test accessible UI."
    },
    "storybook": {
      "name": "Storybook",
      "description": "Isolated development and testing of UI components."
    },
    "openai-prompt-caching": {
      "name": "OpenAI Prompt Caching",
      "description": "Automatically reduces cost by reusing the cached prompt prefix in OpenAI."
    },
    "openai-prompt-engineering": {
      "name": "OpenAI Prompt Engineering",
      "description": "Write precise prompts for fewer iterations and fewer tokens."
    },
    "gemini-context-caching": {
      "name": "Gemini Context Caching",
      "description": "Cache large repeated context in Gemini (explicit or implicit) to make input cheaper."
    },
    "gemini-caching-api": {
      "name": "Gemini Caching API",
      "description": "Gemini cachedContents API: create, reuse, update TTL and delete caches."
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM Cost Tracking",
      "description": "Measure and attribute cost per key/user/team with the LiteLLM proxy."
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "Unified gateway to 100+ LLMs (OpenAI format) with caching, fallbacks and routing."
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "Figma AI: canvas agent, image generation and design-to-code."
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make: from prompt or frame to a functional prototype/app with real code."
    },
    "figma-ai-tools": {
      "name": "Figma AI Tools",
      "description": "AI tools in Figma Design: First Draft, rename layers, images, text."
    },
    "framer": {
      "name": "Framer",
      "description": "Framer: no-code sites with a visual canvas, AI agents, CMS and publishing."
    },
    "relume": {
      "name": "Relume",
      "description": "Relume: from brief to sitemap, wireframes and style guide with AI + library."
    },
    "design-md-tokens": {
      "name": "DESIGN.md (token-based system)",
      "description": "Generate UI faithful to a brand with a structured DESIGN.md: color/typography/spacing tokens, component specs and do/don't rules (voltagent, MIT)."
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "Guides the agent to build Next.js apps with the App Router (Server Components, route handlers, layouts)."
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "Helps the agent integrate LLMs with the AI SDK (generateText, streamText, tools, structured output)."
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "Guides the agent to route requests to multiple models via AI Gateway (one endpoint, fallback, observability)."
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDKs and CLI",
      "description": "Guides the agent to use OpenAI's official SDKs (Python/Node) and the API idiomatically."
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "Helps the agent generate and refine React/Tailwind/shadcn UI with v0 from prompts."
    },
    "web-quality-audit": {
      "name": "Web quality audit",
      "description": "Comprehensive web quality audit (performance, accessibility, SEO, security) with severity classification."
    },
    "web-performance": {
      "name": "Web performance",
      "description": "Optimize load speed and runtime efficiency (resource budget + Lighthouse)."
    },
    "core-web-vitals": {
      "name": "Core Web Vitals (LCP/INP/CLS)",
      "description": "Improve LCP, INP and CLS (thresholds at the 75th percentile)."
    },
    "web-accessibility": {
      "name": "Web accessibility (WCAG 2.2)",
      "description": "Audit and improve accessibility per WCAG 2.2 (target AA)."
    },
    "web-seo": {
      "name": "SEO (technical + on-page)",
      "description": "Optimize search engine visibility: technical SEO, on-page and structured data."
    },
    "web-best-practices": {
      "name": "Web best practices (security)",
      "description": "Modern patterns for security, compatibility and code quality."
    }
  }
} as const;

export default assistantPart2;
