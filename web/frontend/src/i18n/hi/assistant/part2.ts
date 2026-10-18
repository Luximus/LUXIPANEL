const assistantPart2 = {
  "cliUsageBars": {
    "sourceReal": "खाते का शेष कोटा",
    "sourceEstimated": "अनुमानित शेष टोकन",
    "sourceTokens": "शेष टोकन",
    "cliUsage": "CLI शेष",
    "session5h": "सत्र (5h)",
    "week": "सप्ताह",
    "sessionHours": "सत्र ({hours}h)",
    "resetSameDay": "{time} को रीसेट होगा",
    "resetOtherDay": "{day}, {time} को रीसेट होगा",
    "unavailable": "{provider} का कोटा लोड नहीं हो सका",
    "retry": "पुनः प्रयास करें"
  },
  "notifySettings": {
    "title": "सहायक सूचनाएं",
    "description": "जब कोई चैट समाप्त हो और मैं उसे न देख रहा हूं, तब मुझे मेरे उपकरणों (वेब, ऐप और डेस्कटॉप) पर सूचित करें।",
    "saveError": "सहेजा नहीं जा सका।"
  },
  "voiceSettings": {
    "title": "आवाज़ (ऑडियो)",
    "description": "OpenAI से सहायक से बात करें और उसके जवाब सुनें।",
    "missingCapabilities": "ऑडियो चालू करने के लिए Codex प्रदाता में OpenAI API कुंजी कॉन्फ़िगर करें।",
    "inputLabel": "इनपुट (STT)",
    "outputLabel": "आउटपुट (TTS)",
    "notAvailable": "उपलब्ध नहीं",
    "voiceLabel": "आवाज़",
    "autoSpeak": "समाप्त होने पर उत्तर स्वतः पढ़कर सुनाएँ",
    "audioProvider": "ऑडियो प्रदाता",
    "providerApi": "API (OpenAI/Gemini)",
    "providerPiper": "Piper (स्थानीय)",
    "providerMinimax": "MiniMax",
    "providerApiHint": "पहले से कॉन्फ़िगर की गई API कुंजी का उपयोग करता है।",
    "piperReady": "Piper स्थापित",
    "piperMissing": "Piper स्थापित नहीं",
    "minimaxReady": "MiniMax तैयार",
    "minimaxMissing": "MiniMax अनुपलब्ध",
    "minimaxAuthMissing": "MiniMax कुंजी अनुपस्थित",
    "minimaxVoiceHint": "उपयोग करने के लिए MiniMax आवाज़।"
  },
  "agentMarket": {
    "creationUncertain": "प्रोफ़ाइल बनना पुष्ट नहीं हो सका। डुप्लिकेट से बचने के लिए अनुरोध दोबारा नहीं भेजा जाएगा। कैटलॉग देखें और बनाई गई प्रोफ़ाइल को केवल तभी चुनें जब आप उसे पहचान सकें; यदि वह नहीं दिखती, तो परिणाम अभी भी अपुष्ट है।",
    "reviewProfiles": "कैटलॉग देखें",
    "recoverProfile": "बनाई गई प्रोफ़ाइल चुनें",
    "overrideHint": "सहेजने पर ये सेटिंग्स इस परियोजना के विरासत में मिले कॉन्फ़िगरेशन की जगह लेंगी।",
    "title": "Market",
    "description": "इस सर्वर की परियोजनाओं के लिए दोबारा उपयोग योग्य प्रोफ़ाइल।",
    "search": "नाम, विवरण, विशेषज्ञता या तकनीक से खोजें",
    "project": "सक्रिय परियोजना",
    "chooseProject": "परियोजना चुनें",
    "allProviders": "सभी प्रदाता",
    "allRoles": "सभी भूमिकाएँ",
    "allAssignments": "सभी असाइनमेंट",
    "assigned": "असाइन किया गया",
    "unassigned": "असाइन नहीं किया गया",
    "inherited": "विरासत में मिला",
    "removed": "हटाया गया",
    "empty": "अभी कोई एजेंट प्रोफ़ाइल नहीं है।",
    "noMatches": "इन फ़िल्टर से कोई प्रोफ़ाइल नहीं मिली।",
    "loading": "कैटलॉग लोड हो रहा है…",
    "retry": "फिर कोशिश करें",
    "error": "कैटलॉग लोड या अपडेट नहीं हो सका।",
    "pending": "कार्रवाई जारी है…",
    "add": "परियोजना में जोड़ें",
    "remove": "परियोजना से हटाएँ",
    "configure": "असाइनमेंट कॉन्फ़िगर करें",
    "editProfile": "वैश्विक प्रोफ़ाइल संपादित करें",
    "profileHint": "प्रोफ़ाइल के बदलाव उसकी सभी परियोजनाओं पर लागू होंगे।",
    "assignmentHint": "यह कॉन्फ़िगरेशन केवल चुनी गई परियोजना पर लागू होता है।",
    "removeConfirm": "{name} को इस परियोजना से हटाएँ? प्रोफ़ाइल और इतिहास सुरक्षित रहेंगे।",
    "saved": "बदलाव सहेजे गए।",
    "specialty": "विशेषज्ञता",
    "technologies": "तकनीकें (अल्पविराम से अलग करें)",
    "newProfile": "प्रोफ़ाइल बनाएँ",
    "back": "चैट पर वापस जाएँ",
    "inheritedHint": "{project} से विरासत में मिला। हटाने का प्रबंधन मूल परियोजना में करें।",
    "readOnly": "केवल पढ़ने के लिए",
    "busy": "काम या अनुमोदन लंबित हैं। असाइनमेंट बदलने से पहले उन्हें पूरा करें।",
    "forbidden": "आपको यह कार्रवाई करने की अनुमति नहीं है।",
    "contextChanged": "सर्वर या सत्र बदल गया है। कैटलॉग फिर से लोड करें।",
    "uncertain": "परिणाम की पुष्टि नहीं हो सकी। कार्रवाई दोहराने से पहले कैटलॉग जाँचें।",
    "historical": "ऐतिहासिक: नई चैट के लिए उपलब्ध नहीं",
    "inherit": "प्रोफ़ाइल से लें",
    "none": "कोई नहीं",
    "jobTitle": "परियोजना में पद",
    "instructions": "परियोजना के निर्देश",
    "limitsHint": "सीमाएँ मौजूदा अनुमतियों के साथ लागू होती हैं; अतिरिक्त पहुँच नहीं देतीं।"
  },
  "agentsTab": {
    "teams": {
      "newTeamBtn": "नई टीम",
      "newTeamTitle": "टीम बनाएं",
      "editTeamTitle": "टीम संपादित करें",
      "nameLabel": "नाम",
      "namePlaceholder": "उदा. Backend, Frontend, Design…",
      "descriptionLabel": "विवरण (वैकल्पिक)",
      "colorLabel": "रंग",
      "createBtn": "टीम बनाएं",
      "saveBtn": "सहेजें",
      "cancelBtn": "रद्द करें",
      "addAgentsBtn": "एजेंट जोड़ें",
      "addAgentsTitle": "टीम में एजेंट जोड़ें",
      "addAgentsEmpty": "जोड़ने के लिए कोई एजेंट उपलब्ध नहीं है।",
      "addAgentsConfirm": "जोड़ें",
      "alreadyInTeam": "दूसरी टीम में",
      "removeFromTeamBtn": "टीम से हटाएं",
      "removeFromTeamConfirm": "इस एजेंट को टीम से हटाएं? एजेंट हटाया नहीं जाता।",
      "deleteTeamBtn": "टीम हटाएं",
      "deleteTeamConfirm": "इस टीम को हटाएं?",
      "deleteTeamKeepsAgentsNote": "एजेंट हटाए नहीं जाते: उन्हें केवल टीम से हटाया जाता है।",
      "teamSelectorLabel": "टीम",
      "groupRequired": "समूह चुनें या बनाएँ",
      "teamSelectorPlaceholder": "— समूह चुनें —",
      "noTeamOption": "कोई टीम नहीं",
      "emptyTeamHint": "खाली टीम — + बटन से एजेंट जोड़ें।",
      "memberCount": "{count} सदस्य"
    },
    "cancel": "रद्द करें",
    "saving": "सहेजा जा रहा है…",
    "saveChanges": "बदलाव सहेजें",
    "noDescription": "विवरण नहीं",
    "allTools": "सभी tools",
    "toolsCount": "{count} उपकरण",
    "noActiveModules": "कोई सक्रिय मॉड्यूल नहीं जिनमें tools हों।",
    "removeAll": "सब हटाएं",
    "selectAll": "सब चुनें",
    "sensitiveTool": "संवेदनशील क्रिया",
    "confirmDeleteAgent": "क्या एजेंट \"{name}\" को हटाएं?",
    "confirmDeleteRole": "क्या भूमिका \"{name}\" हटाएं? जो एजेंट इसका उपयोग करते हैं, उनसे यह हट जाएगी।",
    "duplicateName": "{name} (प्रतिलिपि)",
    "editBtn": "संपादित करें",
    "deleteTitle": "हटाएं",
    "errorPrefix": "त्रुटि: {message}",
    "backToAgents": "एजेंट",
    "createdBy": "{ownerName} द्वारा बनाया गया",
    "diagram": {
      "empty": "कोई एजेंट नहीं — यहाँ देखने के लिए एक बनाएं",
      "connection": "कनेक्शन"
    },
    "archetypes": {
      "devops": "DevOps / SRE",
      "security": "सुरक्षा लेखापरीक्षक",
      "dba": "डेटाबेस प्रशासक",
      "support": "तकनीकी सहायता",
      "nginx": "वेब प्रशासक / Nginx",
      "backups": "बैकअप विशेषज्ञ",
      "logs": "लॉग विश्लेषक",
      "automation": "स्वचालन / Cron"
    },
    "editor": {
      "titleNew": "नया एजेंट",
      "titleEdit": "एजेंट संपादित करें",
      "headerTitleNew": "नया एजेंट",
      "headerDescNew": "एक नया AI एजेंट सेट करें",
      "headerTitleEdit": "एजेंट संपादित करना",
      "headerDescEdit": "एजेंट का कॉन्फ़िगरेशन बदलें",
      "backToList": "एजेंट पर वापस जाएँ",
      "tabGeneral": "सामान्य",
      "tabModel": "मॉडल",
      "tabHierarchy": "पदानुक्रम",
      "tabTools": "टूल्स",
      "tabResources": "संसाधन",
      "tabAccess": "एक्सेस",
      "aiHelpTitle": "AI सहायता",
      "aiHelpDesc": "एक प्रोफ़ाइल चुनें और AI पेशेवर तरीके से नाम, विवरण, prompt और टूल्स तैयार करेगी।",
      "aiHelpSelect": "एक प्रोफ़ाइल चुनें…",
      "aiHelpFromDesc": "मेरे विवरण से",
      "aiHelpFromDescTitle": "मौजूदा विवरण से सुधारें",
      "aiHelpGenerating": "AI से एजेंट बना रहे हैं…",
      "fieldName": "नाम",
      "namePlaceholder": "उदा. सुरक्षा लेखापरीक्षक",
      "fieldDescription": "विवरण",
      "descPlaceholder": "यह एजेंट किस काम के लिए है",
      "fieldSystemPrompt": "सिस्टम Prompt",
      "systemPromptPlaceholder": "एजेंट के निर्देश, व्यक्तित्व और लक्ष्य…",
      "fieldAvatar": "अवतार",
      "avatarRandomize": "यादृच्छिक",
      "avatarAuto": "स्वतः",
      "avatarAttrs": {
        "top": "बाल / टोपी",
        "hairColor": "बालों का रंग",
        "eyes": "आंखें",
        "eyebrows": "भौहें",
        "mouth": "मुंह",
        "skinColor": "त्वचा का रंग",
        "clothing": "कपड़े",
        "clothesColor": "कपड़ों का रंग",
        "accessories": "एक्सेसरी",
        "facialHair": "दाढ़ी",
        "facialHairColor": "दाढ़ी का रंग"
      },
      "fieldProvider": "प्रदाता",
      "fieldModel": "मॉडल",
      "modelPlaceholder": "(प्रदाता का डिफ़ॉल्ट)",
      "realtimeLabel": "रियल-टाइम संचार (कम विलंबता सत्र)",
      "realtimeDesc": "ऑडियो/टेक्स्ट स्ट्रीमिंग का द्विदिशात्मक सत्र (प्रदाता के अनुसार: OpenAI Realtime या Gemini Live)।",
      "realtimeUnavailable": "प्रदाता \"{providerId}\" रियल-टाइम सत्र प्रदान नहीं करता। केवल codex (OpenAI) या gemini के साथ उपलब्ध।",
      "multiAgentLabel": "मल्टी-एजेंट मोड: इस एजेंट को कई बार समानांतर में दोहराएं",
      "multiAgentDescPre": "एजेंट ",
      "multiAgentDescBold": "X गुना हो जाता है",
      "multiAgentDescPost": ": कार्य X भागों में विभाजित होता है और प्रत्येक प्रतिलिपि (समान prompt, टूल्स और प्रदाता) एक भाग समानांतर में हल करती है; फिर एक ही उत्तर संश्लेषित होता है।",
      "multiAgentCopies": "प्रतिलिपियों की संख्या (X)",
      "multiAgentCopiesHint": "एजेंट की प्रतिलिपियाँ (2–8)",
      "multiAgentProvidersPre": "वैकल्पिक — प्रतिलिपियाँ कई प्रदाताओं में वितरित करें (मुख्य ",
      "multiAgentProvidersPost": " हमेशा भाग लेता है; अन्य को वितरण के लिए चुनें):",
      "multiAgentApiHint": "केवल API key वाले API मोड में प्रदाता उपयोग होते हैं। मल्टी-एजेंट के लिए API मोड आवश्यक है।",
      "roleHeading": "भूमिका और पदानुक्रम",
      "roleAssigned": "असाइन की गई भूमिका",
      "roleNone": "कोई भूमिका नहीं",
      "roleHint": "भूमिका एक बेस prompt और डिफ़ॉल्ट टूल्स प्रदान करती है; एजेंट इसे परिष्कृत करता है। एजेंट सूची से भूमिकाएं प्रबंधित करें।",
      "parentAgent": "वरिष्ठ एजेंट (अधीनता)",
      "parentNone": "कोई नहीं (शीर्ष स्तर)",
      "parentHintPre": "इसका वरिष्ठ ",
      "parentHintBold": "कार्य सौंप सकता है",
      "parentHintPost": " निष्पादन के दौरान और उसका उत्तर उपयोग कर सकता है।",
      "connectionsLabel": "अन्य एजेंटों से कनेक्शन",
      "connectionsEmpty": "कोई अन्य एजेंट नहीं।",
      "connectionsHint": "द्विदिशात्मक चैनल: दोनों में से कोई भी निष्पादन के दौरान एक-दूसरे से जानकारी माँग या दे सकता है (प्रत्यायोजन टूल)।",
      "supervisorLabel": "सुपरवाइजर: अपने अधीनस्थों के लिए चैट बना सकता है",
      "supervisorDesc": "Chat टैब में वास्तविक चैट खोलता है और अपने अधीनस्थों को काम पर लगाता है (प्रत्येक चैट उस एजेंट की लॉगबुक बन जाती है)। भूमिका के माध्यम से भी यह अनुमति दी जाती है।",
      "allowAllTools": "सभी उपलब्ध टूल्स की अनुमति दें",
      "toolsDesc": "वह टूल्स सबसेट चुनें जो यह एजेंट उपयोग कर सकता है। सूची प्रत्येक मॉड्यूल की अनुमतियों के साथ प्रतिच्छेद होती है, इसलिए यह कभी अनुमतियाँ नहीं बढ़ाती।",
      "associatedServers": "संबद्ध सर्वर",
      "serversEmpty": "कोई पंजीकृत सर्वर नहीं।",
      "attachedProjects": "संलग्न प्रोजेक्ट",
      "attachedProjectsDesc": "ट्री से एक या कई प्रोजेक्ट चुनें। पैरेंट प्रोजेक्ट चुनने से उसके सभी नेस्टेड फ़ोल्डर चुने जाते हैं; एजेंट चुने गए प्रोजेक्ट्स के वर्क पाथ उपयोग करता है।",
      "noParentProjects": "कोई प्रोजेक्ट नहीं।",
      "graphIndexesTitle": "कोड ग्राफ़ इंडेक्स",
      "graphIndexesDesc": "एजेंट पूरी फ़ाइलें पढ़ने के बजाय ग्राफ़ के ज़रिए कोड एक्सप्लोर करने के लिए इन इंडेक्स का उपयोग करेगा (सिंबल, कॉल और आर्किटेक्चर) — इससे टोकन खपत घटती है।",
      "graphIndexesEmpty": "कोई ग्राफ़ इंडेक्स उपलब्ध नहीं। प्रोजेक्ट्स टैब से किसी प्रोजेक्ट को इंडेक्स करें।",
      "credentialTitle": "एक्सेस क्रेडेंशियल",
      "saveObsidian": "संलग्न प्रोजेक्ट के Obsidian vault में सारांश सहेजें",
      "agentSkills": "एजेंट के Skills",
      "createAgent": "एजेंट बनाएं",
      "snippetsSection": "टर्मिनल Snippets",
      "snippetsCategoryLabel": "Snippets की श्रेणी",
      "snippetsCategoryNone": "(कोई नहीं)",
      "snippetsTagsLabel": "श्रेणी के टैग",
      "snippetsHelp": "इस एजेंट के लिए उपलब्ध टर्मिनल snippets को पहले से फ़िल्टर करें: एक श्रेणी चुनें और, वैकल्पिक रूप से, उस श्रेणी के टैग। श्रेणी नहीं = फ़िल्टर नहीं।",
      "snippetsNoAccess": "टर्मिनल snippets लोड नहीं हो सके (टर्मिनल अनुमति आवश्यक है)।",
      "snippetsNoTags": "इस श्रेणी में कोई टैग नहीं हैं।"
    },
    "roleEditor": {
      "titleNew": "नई भूमिका",
      "titleEdit": "भूमिका संपादित करें",
      "fieldName": "भूमिका का नाम",
      "namePlaceholder": "उदा. समन्वयक, लेखापरीक्षक, डेटाबेस विशेषज्ञ",
      "fieldDesc": "विवरण",
      "descPlaceholder": "यह भूमिका क्या दर्शाती है",
      "fieldBasePrompt": "भूमिका का बेस Prompt",
      "basePromptPlaceholder": "इस भूमिका वाले सभी एजेंटों की सामान्य नीतियाँ, जिम्मेदारियाँ और लहजा…",
      "basePromptHint": "एजेंट के अपने prompt से पहले बेस के रूप में इंजेक्ट होता है।",
      "noToolLimit": "भूमिका से टूल्स की कोई सीमा नहीं",
      "toolsDesc": "भूमिका के टूल्स यह सीमित करते हैं कि उसके एजेंट क्या उपयोग कर सकते हैं (प्रतिच्छेद होता है, कभी विस्तार नहीं)।",
      "supervisorLabel": "सुपरवाइजर पद: इस भूमिका वाले एजेंट अपने अधीनस्थों के लिए चैट बना सकते हैं",
      "supervisorDesc": "इस भूमिका वाले प्रत्येक एजेंट को सुपरवाइजर के रूप में कार्य करने की अनुमति देता है (चैट खोलने और काम सौंपने का टूल)।",
      "createRole": "भूमिका बनाएं"
    },
    "treeView": {
      "title": "एजेंट पदानुक्रम",
      "reloadTitle": "एजेंट पुनः लोड करें और ट्री पुनः बनाएं",
      "regenerating": "पुनः बना रहे हैं…",
      "regenerate": "पुनः बनाएं",
      "description": "अधीनता ट्री का आरेख (ठोस रेखा = वरिष्ठ → अधीनस्थ) और समकक्षों के बीच कनेक्शन (बिंदीदार रेखा)। ट्री बनाने के लिए प्रत्येक एजेंट के संपादक में «वरिष्ठ एजेंट» असाइन करें।"
    },
    "rolesList": {
      "newRole": "नई भूमिका",
      "description": "पुन: उपयोग योग्य भूमिकाएं (बेस prompt और टूल्स के साथ प्रोफ़ाइल) जो आप एक या कई एजेंटों को असाइन करते हैं।",
      "emptyTitle": "अभी कोई भूमिका नहीं",
      "emptyDesc": "कई एजेंटों के व्यवहार को मानकीकृत करने के लिए एक भूमिका बनाएं।",
      "agentsCount": "{count} एजेंट"
    },
    "list": {
      "description": "कस्टम AI एजेंट: अपना prompt, टूल्स और प्रदाता/मॉडल। चैट में उपयोग करें या Cron में प्रोग्राम करें।",
      "treeBtn": "ट्री",
      "treeBtnTitle": "एजेंट पदानुक्रम ट्री देखें",
      "rolesBtn": "भूमिकाएं",
      "rolesBtnTitle": "एजेंट भूमिकाएं बनाएं और प्रबंधित करें",
      "newAgent": "नया एजेंट",
      "loading": "एजेंट लोड हो रहे हैं…",
      "emptyTitle": "अभी कोई एजेंट नहीं",
      "emptyDesc": "कस्टम prompt और टूल्स सेट के साथ चैट करने के लिए एक बनाएं।",
      "multiAgentTitle": "मल्टी-एजेंट: {count} प्रतिलिपियाँ",
      "roleAssignedTitle": "असाइन की गई भूमिका",
      "subordinateTitle": "अधीनस्थ",
      "connectionsTitle": "अन्य एजेंटों से कनेक्शन",
      "supervisorTitle": "सुपरवाइजर: अधीनस्थों के लिए चैट बना सकता है",
      "supervisorBadge": "सुपरवाइजर",
      "realtimeTitle": "रियल-टाइम संचार",
      "realtimeBadge": "रियल-टाइम",
      "startChat": "चैट शुरू करें",
      "duplicateTitle": "डुप्लीकेट करें",
      "noRoleGroupTitle": "कोई कार्य समूह नहीं",
      "groupAria": "कार्य समूह: {name}",
      "groupCount": "{count} एजेंट",
      "noRoleGroupDesc": "बिना भूमिका वाले एजेंट। संपादक से एक भूमिका असाइन करें।"
    },
    "resync": {
      "applying": "बन रहे हैं…",
      "close": "बंद करें",
      "btn": "टेम्पलेट से सिंक करें",
      "btnTitle": "इस टीम की उसके टेम्पलेट से तुलना करें और अनुपस्थित एजेंट बनाएँ",
      "modalTitle": "«{name}» को उसके टेम्पलेट से सिंक करें",
      "loading": "टेम्पलेट से तुलना की जा रही है…",
      "markersMissing": "इस टीम के टेम्पलेट स्रोत चिह्न खो गए हैं, इसलिए इसकी अपने आप तुलना नहीं हो सकती। आप अनुपस्थित एजेंट स्वयं बना सकते हैं।",
      "missingHeading": "अनुपस्थित",
      "presentHeading": "मौजूद",
      "extraHeading": "स्वयं जोड़े गए",
      "extraNote": "इन्हें बदला नहीं जाएगा।",
      "nothingMissing": "टीम पूरी है: टेम्पलेट का कोई एजेंट अनुपस्थित नहीं है।",
      "confirm": "चुने हुए बनाएँ"
    }
  },
  "accessTab": {
    "all": "सभी",
    "permissionsTitle": "एक्सेस और अनुमतियाँ",
    "permissionsDescription": "आज सहायक की दृश्यता आपकी प्रोफ़ाइल में assistant मॉड्यूल की अनुमति द्वारा नियंत्रित होती है। प्रति-भूमिका विवरण (assistant.use / assistant.configure / assistant.module.<id>) अगले पुनरावृत्ति के लिए नियोजित है।",
    "recentInvocations": "हाल की टूल कॉल",
    "refreshAriaLabel": "एक्सेस ताज़ा करें",
    "loading": "लोड हो रहा है...",
    "emptyRecent": "कोई हालिया गतिविधि नहीं।",
    "emptyProvider": "इस प्रदाता के लिए कोई गतिविधि नहीं।",
    "byUser": "द्वारा",
    "crossServerTitle": "संबद्ध सर्वर तक पहुँच",
    "cmdPrefix": "$ ",
    "passwordLabel": "पासवर्ड: ",
    "passphraseLabel": "पासफ़्रेज़: ",
    "privateKeyLabel": "निजी कुंजी",
    "autoApproveRevoke": "रद्द करें",
    "autoApproveTitle": "स्वचालित अनुमोदन",
    "autoApproveDescription": "वे टूल जो अब पुष्टि नहीं माँगते («स्वीकृत करें और फिर न पूछें» से स्वीकृत)। बदलाव अगली बार चलने से लागू होंगे।",
    "autoApproveEmpty": "स्वचालित स्वीकृति वाला कोई टूल नहीं है। एजेंट की कार्रवाई स्वीकृत करते समय «स्वीकृत करें और फिर न पूछें» चुनने पर यह सूची भरेगी।",
    "autoApproveModeAuto": "स्वचालित मोड: यह सूची लागू नहीं होती"
  },
  "directoryPicker": {
    "title": "फ़ोल्डर चुनें",
    "goUp": "ऊपर जाएं",
    "loading": "लोड हो रहा है…",
    "emptyDirs": "(कोई उपफ़ोल्डर नहीं)",
    "cancel": "रद्द करें",
    "select": "यह फ़ोल्डर उपयोग करें",
    "readError": "डायरेक्टरी पढ़ी नहीं जा सकी"
  },
  "skillsSettings": {
    "title": "असिस्टेंट की skills और विधियाँ",
    "helper": "असिस्टेंट के व्यवहार को बेहतर बनाने वाली लाइब्रेरी, skills और विधियाँ सक्षम या अक्षम करें।",
    "tokenNote": "प्रत्येक skill के निर्देश कैश्ड prompt में शामिल होते हैं (अगले चरणों में ~0.1×)। Ponytail कोड और आउटपुट tokens घटाता है; UI/UX Pro Max में कम खर्च के लिए «संक्षिप्त» स्तर उपयोग करें।",
    "search": "skill खोजें…",
    "allCategories": "सभी श्रेणियाँ",
    "loading": "skills लोड हो रही हैं...",
    "empty": "कोई skill उपलब्ध नहीं।",
    "noMatch": "कोई skill फ़िल्टर से मेल नहीं खाती।",
    "sourcePrefix": "स्रोत:",
    "errorGeneric": "skill अपडेट नहीं हो सकी। दोबारा कोशिश करें।",
    "activeShown": "{count} सक्रिय · {shown} दिखाई गई।"
  },
  "skillsPicker": {
    "searchPlaceholder": "skill खोजें…",
    "resetTitle": "अनुकूलन हटाएं (वैश्विक skills उपयोग करें)",
    "reset": "रीसेट करें ({count})",
    "loading": "skills लोड हो रही हैं…",
    "empty": "कोई skill नहीं।",
    "globalNote": "ये केवल आपके चैट में लागू होती हैं, प्रदाता की वैश्विक skills के अतिरिक्त।"
  },
  "skillCategories": {
    "methods": "असिस्टेंट के तरीके",
    "code-quality": "कोड गुणवत्ता",
    "web-quality": "वेब गुणवत्ता (Lighthouse / CWV)",
    "ui-ux": "UI / UX / डिज़ाइन",
    "web-fullstack": "वेब / फुल-स्टैक AI विकास",
    "mobile": "मोबाइल ऐप",
    "code-agents": "कोड एजेंट",
    "reusable-skills": "पुन:उपयोगी AI स्किल",
    "security": "AI / वेब / ऐप सुरक्षा",
    "token-savings": "टोकन बचत / AI लागत",
    "ai-prod": "प्रोडक्शन में AI एजेंट",
    "devops": "DevOps / तैनाती",
    "testing": "परीक्षण / कोड गुणवत्ता",
    "data-rag": "डेटाबेस / RAG / खोज",
    "automation": "स्वचालन / वर्कफ़्लो",
    "other": "अन्य"
  },
  "skillCatalog": {
    "ask-protocol": {
      "name": "निर्णय से पहले पूछें",
      "description": "असिस्टेंट को किसी महत्वपूर्ण निर्णय पर रुककर आपसे पूछने देता है, बजाय अनुमान लगाने के (lxp_ask टूल + प्रश्न प्रोटोकॉल)।"
    },
    "project-context-vault": {
      "name": "प्रोजेक्ट संदर्भ (Obsidian)",
      "description": "प्रोजेक्ट संदर्भ नोट्स (Contexto.md / Errores.md) इंजेक्ट करता है और obsidian.search_notes से और खोजने देता है।"
    },
    "ponytail": {
      "name": "Ponytail (न्यूनतम कोड)",
      "description": "न्यूनतमवादी विकास मोड: केवल आवश्यक कोड लिखें (निर्णय सीढ़ी + गार्डरेल)।"
    },
    "ui-ux-pro-max": {
      "name": "UI/UX Pro Max (इंटरफ़ेस गुणवत्ता)",
      "description": "पेशेवर UI/UX मानक (पहुँच, टच, टाइपोग्राफी, स्थिति) प्रॉम्प्ट में इंजेक्ट किए जाते हैं; संक्षिप्त या पूर्ण स्तर।"
    },
    "openai-agents-sdk": {
      "name": "OpenAI Agents SDK",
      "description": "टूल, हैंडऑफ़, गार्डरेल, सत्र और ट्रेसिंग के साथ OpenAI एजेंट।"
    },
    "openai-agents-python": {
      "name": "OpenAI Agents Python SDK",
      "description": "एजेंट के लिए Python SDK: Agent, Runner, @function_tool, हैंडऑफ़ और ट्रेसिंग।"
    },
    "openai-agents-js": {
      "name": "OpenAI Agents JS SDK",
      "description": "OpenAI एजेंट के लिए TypeScript/JS SDK: Agent, run, टूल (Zod), हैंडऑफ़।"
    },
    "mcp-docs": {
      "name": "Model Context Protocol",
      "description": "LLMs को टूल, संसाधन और प्रॉम्प्ट से जोड़ने का खुला मानक ('AI का USB-C')।"
    },
    "mcp-github": {
      "name": "MCP (GitHub)",
      "description": "MCP GitHub org: आधिकारिक SDK (10 भाषाएँ), संदर्भ सर्वर और इंस्पेक्टर।"
    },
    "anthropic-mcp-intro": {
      "name": "Anthropic MCP Intro",
      "description": "Anthropic की घोषणा: MCP एक खुले मानक के रूप में जो N×M एकीकरण हल करता है।"
    },
    "n8n": {
      "name": "n8n",
      "description": "फेयर-कोड, सेल्फ-होस्टेबल वर्कफ़्लो ऑटोमेशन।"
    },
    "make": {
      "name": "Make",
      "description": "परिदृश्यों द्वारा विज़ुअल नो-कोड ऑटोमेशन (पहले Integromat)।"
    },
    "zapier": {
      "name": "Zapier",
      "description": "ट्रिगर और एक्शन (Zaps) के ज़रिए SaaS ऑटोमेशन।"
    },
    "temporal": {
      "name": "Temporal",
      "description": "टिकाऊ, फॉल्ट-टॉलरेंट वर्कफ़्लो का ऑर्केस्ट्रेशन।"
    },
    "bullmq": {
      "name": "BullMQ",
      "description": "Node.js के लिए Redis-आधारित जॉब क्यू।"
    },
    "langgraph": {
      "name": "LangGraph",
      "description": "LLM एजेंटों को स्टेटफुल ग्राफ के रूप में ऑर्केस्ट्रेट करना।"
    },
    "codex-cli": {
      "name": "OpenAI Codex CLI",
      "description": "एजेंट को OpenAI के Codex CLI (टर्मिनल कोड एजेंट) का उपयोग करने के लिए मार्गदर्शन करता है।"
    },
    "codex-cli-features": {
      "name": "Codex CLI Features",
      "description": "एजेंट को Codex CLI की क्षमताओं (सैंडबॉक्स, अनुमोदन, MCP, कॉन्फ़िग) के बारे में विस्तृत जानकारी देता है।"
    },
    "codex-cloud": {
      "name": "Codex Cloud",
      "description": "एजेंट को Codex Cloud (रिमोट परिवेश, समानांतर निष्पादन, PR) को कार्य सौंपने के लिए मार्गदर्शन करता है।"
    },
    "claude-code-skills": {
      "name": "Claude Code Skills",
      "description": "एजेंट को Claude Code Skills (SKILL.md सहित फ़ोल्डर, Agent Skills मानक) बनाने और उपयोग करने के लिए मार्गदर्शन करता है।"
    },
    "copilot-cloud-agent": {
      "name": "GitHub Copilot Cloud Agent",
      "description": "एजेंट को GitHub Copilot कोडिंग एजेंट को समस्याएँ सौंपने के लिए मार्गदर्शन करता है, जो क्लाउड में कार्य करता है और PR खोलता है।"
    },
    "cursor": {
      "name": "Cursor",
      "description": "एजेंट को Cursor एडिटर (Agent, रेपो संदर्भ, नियम) में कार्य करने के लिए मार्गदर्शन करता है।"
    },
    "agents-md": {
      "name": "AGENTS.md",
      "description": "एजेंट को AGENTS.md लिखने और उसका पालन करने के लिए मार्गदर्शन करता है, जो कोड एजेंटों के लिए मानक निर्देश फ़ाइल है।"
    },
    "open-design-contribute": {
      "name": "Open Design — योगदान करें (नो-कोड)",
      "description": "Open Design (nexu-io) में योगदान के लिए निर्देशित नो-कोड प्रवाह: एक Skill या Design System सबमिट करें, दस्तावेज़ अनुवाद करें, कॉपी ठीक करें या बग रिपोर्ट करें, और यह आपके लिए PR/इश्यू खोलता है।"
    },
    "supabase": {
      "name": "Supabase",
      "description": "ऑथ, स्टोरेज और रियलटाइम के साथ प्रबंधित Postgres बैकएंड।"
    },
    "postgresql": {
      "name": "PostgreSQL",
      "description": "समृद्ध प्रकारों के साथ मज़बूत रिलेशनल डेटाबेस।"
    },
    "pgvector": {
      "name": "pgvector",
      "description": "Postgres के अंदर वेक्टर समानता खोज।"
    },
    "pinecone": {
      "name": "Pinecone",
      "description": "बड़े पैमाने पर RAG के लिए प्रबंधित वेक्टर डेटाबेस।"
    },
    "qdrant": {
      "name": "Qdrant",
      "description": "पेलोड फ़िल्टरिंग के साथ ओपन-सोर्स वेक्टर इंजन।"
    },
    "weaviate": {
      "name": "Weaviate",
      "description": "स्कीमा और वेक्टराइज़ेशन मॉड्यूल के साथ वेक्टर डेटाबेस।"
    },
    "github-actions": {
      "name": "GitHub Actions",
      "description": "इवेंट-ट्रिगर YAML वर्कफ़्लो (.github/workflows) के साथ GitHub पर CI/CD।"
    },
    "vercel": {
      "name": "Vercel",
      "description": "प्रति-कमिट/PR प्रिव्यू के साथ फ्रंटएंड और सर्वरलेस फ़ंक्शन की तैनाती।"
    },
    "docker": {
      "name": "Docker",
      "description": "हल्के, पुनरुत्पादन योग्य इमेज के साथ ऐप को अल्पकालिक कंटेनर में पैकेज करता है।"
    },
    "nginx": {
      "name": "Nginx",
      "description": "उच्च-प्रदर्शन वेब सर्वर और रिवर्स प्रॉक्सी।"
    },
    "pm2": {
      "name": "PM2",
      "description": "क्लस्टर, रीस्टार्ट और लॉग के साथ Node प्रोसेस मैनेजर।"
    },
    "redis": {
      "name": "Redis",
      "description": "कैशिंग, क्यू और डेटा संरचनाओं के लिए इन-मेमोरी स्टोर।"
    },
    "expo": {
      "name": "Expo",
      "description": "एजेंट को Expo (expo-router, मॉड्यूल, कॉन्फ़िग प्लगइन) से React Native ऐप विकसित करने के लिए मार्गदर्शन करता है।"
    },
    "eas-build": {
      "name": "EAS Build",
      "description": "एजेंट को EAS Build और eas.json प्रोफ़ाइल से क्लाउड में iOS/Android बाइनरी बनाने के लिए मार्गदर्शन करता है।"
    },
    "eas-services": {
      "name": "EAS Services",
      "description": "एजेंट को EAS इकोसिस्टम (Submit, Update/OTA, Workflows) एंड-टू-एंड उपयोग करने में सहायता करता है।"
    },
    "react-native": {
      "name": "React Native",
      "description": "एजेंट को React Native (कोर कंपोनेंट, स्टाइल, प्लेटफ़ॉर्म) से नेटिव UI बनाने के लिए मार्गदर्शन करता है।"
    },
    "firebase-auth": {
      "name": "Firebase Auth",
      "description": "एजेंट को Firebase Auth (प्रदाता, टोकन, सत्र) से प्रमाणीकरण लागू करने के लिए मार्गदर्शन करता है।"
    },
    "claude-agent-skills": {
      "name": "Claude Agent Skills",
      "description": "पुन:उपयोगी क्षमताओं को Agent Skills (SKILL.md) के रूप में पैकेज करता है जो मांग पर लोड होती हैं।"
    },
    "claude-skills-github": {
      "name": "Claude Skills (GitHub)",
      "description": "आधिकारिक anthropics/skills रिपॉज़िटरी: आधार और पैटर्न के रूप में उदाहरण, स्पेक और टेम्पलेट।"
    },
    "codex-agents-md-guide": {
      "name": "Codex AGENTS.md Guide",
      "description": "कोड एजेंटों को प्रोजेक्ट निर्देश देने के लिए Codex का AGENTS.md कन्वेंशन।"
    },
    "owasp-llm-top10": {
      "name": "OWASP Top 10 LLM",
      "description": "LLM ऐप में शीर्ष 10 जोखिम: प्रॉम्प्ट इंजेक्शन, असुरक्षित आउटपुट, अत्यधिक एजेंसी।"
    },
    "owasp-asvs": {
      "name": "OWASP ASVS",
      "description": "ASVS v5.0: स्तर-अनुसार सत्यापन योग्य सुरक्षा आवश्यकताओं का मानक।"
    },
    "codeql": {
      "name": "CodeQL",
      "description": "CodeQL: कोड को डेटा के रूप में क्वेरी करना (डेटा-फ़्लो/टेंट) ताकि कमज़ोरियाँ खोजी जा सकें।"
    },
    "semgrep": {
      "name": "Semgrep",
      "description": "Semgrep: कोड-जैसे नियम SAST + Supply Chain (SCA) और Secrets, उच्च सिग्नल।"
    },
    "snyk": {
      "name": "Snyk",
      "description": "Snyk: निर्देशित उपचार के साथ SCA, Code (SAST), Container, IaC और API/Web (DAST)।"
    },
    "owasp-zap": {
      "name": "OWASP ZAP",
      "description": "OWASP ZAP: DAST के लिए अग्रणी ओपन सोर्स वेब स्कैनर (पैसिव/एक्टिव स्कैन)।"
    },
    "skillspector": {
      "name": "SkillSpector (AI Skills ऑडिट)",
      "description": "स्थापना से पहले AI एजेंट Skills (SKILL.md + स्क्रिप्ट) को कमज़ोरियों और दुर्भावनापूर्ण इरादे के लिए ऑडिट करता है (NVIDIA, Apache-2.0)।"
    },
    "playwright": {
      "name": "Playwright",
      "description": "ऑटो-वेटिंग और ट्रेस के साथ क्रॉस-ब्राउज़र E2E परीक्षण।"
    },
    "cypress": {
      "name": "Cypress",
      "description": "रीट्राई के साथ ब्राउज़र में कंपोनेंट और E2E परीक्षण।"
    },
    "vitest": {
      "name": "Vitest",
      "description": "Vite/ESM नेटिव तेज़ टेस्ट रनर।"
    },
    "jest": {
      "name": "Jest",
      "description": "बिल्ट-इन मॉक और स्नैपशॉट के साथ परीक्षण फ्रेमवर्क।"
    },
    "testing-library": {
      "name": "Testing Library",
      "description": "सुलभ UI परीक्षण के लिए उपयोगकर्ता-केंद्रित क्वेरी।"
    },
    "storybook": {
      "name": "Storybook",
      "description": "UI कंपोनेंट का अलग विकास और परीक्षण।"
    },
    "openai-prompt-caching": {
      "name": "OpenAI Prompt Caching",
      "description": "OpenAI में कैश किए गए प्रॉम्प्ट प्रीफ़िक्स को पुन:उपयोग करके स्वचालित रूप से लागत कम करता है।"
    },
    "openai-prompt-engineering": {
      "name": "OpenAI Prompt Engineering",
      "description": "कम पुनरावृत्ति और कम टोकन के लिए सटीक प्रॉम्प्ट लिखें।"
    },
    "gemini-context-caching": {
      "name": "Gemini Context Caching",
      "description": "इनपुट को सस्ता बनाने के लिए Gemini में बड़े दोहराए जाने वाले संदर्भ को कैश करें (स्पष्ट या अंतर्निहित)।"
    },
    "gemini-caching-api": {
      "name": "Gemini Caching API",
      "description": "Gemini cachedContents API: कैश बनाएँ, पुन:उपयोग करें, TTL अपडेट करें और हटाएँ।"
    },
    "litellm-cost-tracking": {
      "name": "LiteLLM Cost Tracking",
      "description": "LiteLLM प्रॉक्सी से प्रति कुंजी/उपयोगकर्ता/टीम लागत मापें और आवंटित करें।"
    },
    "litellm": {
      "name": "LiteLLM",
      "description": "कैशिंग, फ़ॉलबैक और रूटिंग के साथ 100+ LLMs (OpenAI फ़ॉर्मेट) का एकीकृत गेटवे।"
    },
    "figma-ai": {
      "name": "Figma AI",
      "description": "Figma AI: कैनवास एजेंट, इमेज जनरेशन और डिज़ाइन-टू-कोड।"
    },
    "figma-make": {
      "name": "Figma Make",
      "description": "Figma Make: प्रॉम्प्ट या फ्रेम से वास्तविक कोड के साथ कार्यात्मक प्रोटोटाइप/ऐप तक।"
    },
    "figma-ai-tools": {
      "name": "Figma AI Tools",
      "description": "Figma Design में AI टूल: First Draft, लेयर नाम बदलें, इमेज, टेक्स्ट।"
    },
    "framer": {
      "name": "Framer",
      "description": "Framer: विज़ुअल कैनवास, AI एजेंट, CMS और पब्लिशिंग के साथ नो-कोड साइट।"
    },
    "relume": {
      "name": "Relume",
      "description": "Relume: AI + लाइब्रेरी से ब्रीफ़ से साइटमैप, वायरफ्रेम और स्टाइल गाइड तक।"
    },
    "design-md-tokens": {
      "name": "DESIGN.md (टोकन-आधारित सिस्टम)",
      "description": "एक संरचित DESIGN.md के साथ ब्रांड-वफ़ादार UI जनरेट करें: रंग/टाइपोग्राफी/स्पेसिंग टोकन, कंपोनेंट स्पेक और करें/न करें नियम (voltagent, MIT)।"
    },
    "nextjs-app-router": {
      "name": "Next.js App Router",
      "description": "एजेंट को App Router (Server Components, रूट हैंडलर, लेआउट) के साथ Next.js ऐप बनाने के लिए मार्गदर्शन करता है।"
    },
    "vercel-ai-sdk": {
      "name": "Vercel AI SDK",
      "description": "एजेंट को AI SDK (generateText, streamText, टूल, संरचित आउटपुट) से LLMs एकीकृत करने में सहायता करता है।"
    },
    "vercel-ai-gateway": {
      "name": "Vercel AI Gateway",
      "description": "एजेंट को AI Gateway (एक एंडपॉइंट, फ़ॉलबैक, ऑब्ज़र्वेबिलिटी) के ज़रिए कई मॉडलों में अनुरोध रूट करने के लिए मार्गदर्शन करता है।"
    },
    "openai-sdk-cli": {
      "name": "OpenAI SDKs and CLI",
      "description": "एजेंट को OpenAI के आधिकारिक SDK (Python/Node) और API मुहावरेदार तरीके से उपयोग करने के लिए मार्गदर्शन करता है।"
    },
    "v0-vercel": {
      "name": "v0 by Vercel",
      "description": "एजेंट को प्रॉम्प्ट से v0 के साथ React/Tailwind/shadcn UI जनरेट और परिष्कृत करने में सहायता करता है।"
    },
    "web-quality-audit": {
      "name": "वेब गुणवत्ता ऑडिट",
      "description": "गंभीरता वर्गीकरण के साथ व्यापक वेब गुणवत्ता ऑडिट (प्रदर्शन, पहुँच, SEO, सुरक्षा)।"
    },
    "web-performance": {
      "name": "वेब प्रदर्शन",
      "description": "लोड स्पीड और रनटाइम दक्षता अनुकूलित करें (संसाधन बजट + Lighthouse)।"
    },
    "core-web-vitals": {
      "name": "Core Web Vitals (LCP/INP/CLS)",
      "description": "LCP, INP और CLS में सुधार करें (75वें प्रतिशत पर थ्रेशोल्ड)।"
    },
    "web-accessibility": {
      "name": "वेब पहुँच (WCAG 2.2)",
      "description": "WCAG 2.2 के अनुसार पहुँच ऑडिट और सुधार करें (लक्ष्य AA)।"
    },
    "web-seo": {
      "name": "SEO (तकनीकी + ऑन-पेज)",
      "description": "खोज इंजन दृश्यता अनुकूलित करें: तकनीकी SEO, ऑन-पेज और संरचित डेटा।"
    },
    "web-best-practices": {
      "name": "वेब सर्वोत्तम प्रथाएँ (सुरक्षा)",
      "description": "सुरक्षा, संगतता और कोड गुणवत्ता के लिए आधुनिक पैटर्न।"
    }
  }
} as const;

export default assistantPart2;
