// Auto-split fragment of mail.ts (part 2/2) — data only, keeps <1000 lines.
// Do not reorder keys: the aggregator merges parts by spread in original order.
const mailPart2 = {
  "routing": {
    "labels": {
      "autoRemote": "Automatically Detect Configuration: Remote",
      "local": "Local Mail Exchanger",
      "backup": "Backup Mail Exchanger",
      "remote": "Remote Mail Exchanger"
    },
    "currentMode": "Current: {mode}"
  },
  "tracking": {
    "statuses": {
      "success": "Success",
      "deferred": "Deferred",
      "failure": "Failure",
      "inProgress": "In-Progress",
      "unknown": "Unknown"
    },
    "columns": {
      "event": "Event",
      "fromAddress": "From Address",
      "sentTime": "Sent Time",
      "spamScore": "Spam Score",
      "recipient": "Recipient",
      "domain": "Domain",
      "id": "ID",
      "result": "Result",
      "actions": "Actions"
    },
    "noRecordsFound": "No records found.",
    "zeroRecords": "0 records",
    "matchesZeroRecords": "The search matches 0 records.",
    "recordsCount": "{count} records",
    "matchesRecords": "The search matches {count} records.",
    "detailMeta": "Event: {event} | ID: {id} | Recipient: {recipient}"
  },
  "filters": {
    "ruleParts": {
      "from": "From",
      "subject": "Subject",
      "to": "To",
      "anyRecipient": "Any Recipient",
      "reply": "Reply",
      "body": "Body",
      "anyHeader": "Any Header",
      "notDelivered": "Has Not Been Previously Delivered",
      "errorMessage": "Is an Error Message",
      "listId": "List ID",
      "spamStatus": "Spam Status",
      "spamBar": "Spam Bar",
      "spamScore": "Spam Score"
    },
    "matches": {
      "contains": "contains",
      "matchesRegex": "matches regex",
      "doesNotContain": "does not contain",
      "equals": "equals",
      "beginsWith": "begins with",
      "endsWith": "ends with",
      "doesNotBegin": "does not begin",
      "doesNotEnd": "does not end with",
      "doesNotMatch": "does not match",
      "isAbove": "is above (numbers only)",
      "isNotAbove": "is not above (numbers only)",
      "isBelow": "is below (numbers only)",
      "isNotBelow": "is not below (numbers only)"
    },
    "actions": {
      "discard": "Discard Message",
      "redirect": "Redirect to Email",
      "fail": "Fail With Message",
      "stop": "Stop Processing Rules",
      "deliverToFolder": "Deliver to Folder",
      "pipe": "Pipe to a Program"
    },
    "joinOp": {
      "and": "and",
      "or": "or"
    },
    "removeBtn": "-"
  },
  "defaultAddress": {
    "currentSetting": {
      "none": "Current Setting: (none)",
      "forward": "Current Setting: {destination}",
      "forwardDefault": "(forward)",
      "fail": "Current Setting: :fail: {message}"
    },
    "defaultFailMessage": "No Such User Here"
  },
  "archive": {
    "retentionOptions": {
      "oneMonth": "1 Month",
      "threeMonths": "3 Months",
      "sixMonths": "6 Months",
      "oneYear": "1 Year",
      "twoYears": "2 Years",
      "fiveYears": "5 Years",
      "tenYears": "10 Years",
      "forever": "Forever",
      "custom": "Custom"
    },
    "fields": {
      "incomingEmail": "Incoming Email Messages",
      "outgoingMailingList": "Outgoing Mailing List Email Messages",
      "outgoingEmail": "Outgoing Email Messages"
    }
  },
  "encryption": {
    "neverExpires": "Never Expires"
  },
  "actions": {
    "view": "View",
    "save": "Save",
    "clone": "Clone",
    "copy": "Copy",
    "delete": "Delete",
    "edit": "Edit",
    "remove": "Remove"
  },
  "outbound": {
    "cardTitle": "Panel email sending (SMTP)",
    "cardDesc": "Default account or external SMTP used by the panel to send reports and system emails.",
    "back": "Back",
    "intro": "The identity LUXIPANEL uses to send system emails (cron agent reports, approval links, tests). It can be an email account on this server or an external SMTP that does not belong to the server.",
    "modeLabel": "Sending mode",
    "modeDisabled": "Disabled",
    "modeAccount": "Server email account (default)",
    "modeExternal": "External SMTP",
    "accountLabel": "Default sending account",
    "accountHint": "Uses the stored SMTP credential of that account.",
    "hostLabel": "SMTP server",
    "portLabel": "Port",
    "userLabel": "Username",
    "passLabel": "Password",
    "passPlaceholder": "(unchanged)",
    "fromLabel": "Sender (email)",
    "fromNameLabel": "Sender name",
    "secureLabel": "Direct TLS (port 465)",
    "save": "Save",
    "testPlaceholder": "to@example.com",
    "test": "Send test",
    "hostPlaceholder": "smtp.example.com",
    "fromPlaceholder": "sender@example.com",
    "fromNamePlaceholder": "My Company"
  },
  "table": {
    "status": {
      "active": "Active",
      "inactive": "Inactive",
      "disabled": "Disabled"
    },
    "redirect": {
      "columns": {
        "domain": "Domain",
        "destinos": "Destinations"
      },
      "filters": {
        "searchDomain": "Search domain…"
      },
      "rowActions": {
        "edit": "Edit",
        "delete": "Delete"
      }
    },
    "encryption": {
      "columns": {
        "keyId": "Key ID",
        "label": "Identity",
        "keySize": "Key Size",
        "created": "Created",
        "expires": "Expires"
      },
      "filters": {
        "searchKey": "Search key…"
      },
      "rowActions": {
        "view": "View",
        "delete": "Delete"
      }
    },
    "accounts": {
      "columns": {
        "address": "Address",
        "domain": "Domain",
        "uso": "Quota / Usage",
        "reenvios": "Forwards",
        "estado": "Status"
      },
      "filters": {
        "search": "Search address or domain…",
        "domain": "Domain",
        "estado": "Status"
      },
      "rowActions": {
        "edit": "Edit account",
        "depurarIa": "Clean up with AI",
        "password": "Change password",
        "toggle": "Enable / Disable",
        "inbox": "Open mailbox",
        "signatures": "Manage signatures",
        "default": "Use as default",
        "contacts": "Manage contacts",
        "calendars": "Manage calendars",
        "autoresponder": "Manage autoresponder",
        "filters": "Manage filters",
        "forwards": "Manage forwards",
        "diskusage": "Manage disk usage",
        "clone": "Clone email",
        "delete": "Delete account"
      },
      "quickActions": {
        "bulkForward": "Add forward",
        "bulkQuota": "Change quota",
        "bulkDelete": "Delete accounts"
      }
    },
    "globalFilters": {
      "columns": {
        "name": "Filter",
        "estado": "Status",
        "rules": "Rules",
        "actionsCount": "Actions"
      },
      "filters": {
        "search": "Search filter…"
      },
      "rowActions": {
        "edit": "Edit",
        "delete": "Delete"
      }
    },
    "contacts": {
      "columns": {
        "email": "Email",
        "name": "Name"
      },
      "filters": {
        "searchEmail": "Search email…"
      },
      "rowActions": {
        "edit": "Edit",
        "delete": "Delete"
      }
    },
    "calendars": {
      "columns": {
        "name": "Name",
        "timezone": "Timezone",
        "estado": "Status"
      },
      "filters": {
        "search": "Search calendar…"
      },
      "rowActions": {
        "edit": "Edit",
        "delete": "Delete"
      }
    },
    "signatures": {
      "columns": {
        "sender": "Sender",
        "preview": "Signature"
      },
      "filters": {
        "search": "Filter and search…"
      },
      "rowActions": {
        "edit": "Edit",
        "delete": "Delete"
      }
    },
    "filters": {
      "columns": {
        "name": "Name",
        "estado": "Status"
      },
      "filters": {
        "search": "Search filter…"
      },
      "rowActions": {
        "edit": "Edit",
        "delete": "Delete"
      }
    }
  },
  "confirm": {
    "bulkDeleteAccounts": "Delete {count} email account(s)? This action cannot be undone.",
    "deleteAccount": "Delete the account {address}? This action cannot be undone.",
    "deleteAccountTitle": "Delete account",
    "deleteAutoresponder": "Delete the autoresponder for this account?",
    "deleteByDate": "Emails in {folder} between {from} and {to} will be deleted. Continue?",
    "deleteByDateTitle": "Delete emails by date",
    "deleteCalendar": "Delete calendar \"{label}\"?",
    "deleteCalendarTitle": "Delete calendar",
    "deleteContact": "Delete contact \"{label}\"?",
    "deleteContactTitle": "Delete contact",
    "deleteDomainForward": "Delete the global forward for @{domain}?",
    "deleteDomainForwardTitle": "Delete global forward",
    "deleteEncryptionKey": "Delete this encryption key?",
    "deleteFilter": "Delete the filter \"{name}\"?",
    "deleteFilterTitle": "Delete filter",
    "deleteForward": "Delete the forward to {destination}?",
    "deleteGlobalFilter": "Delete global filter \"{label}\"?",
    "deleteGlobalFilterTitle": "Delete global filter",
    "yesDelete": "Yes, delete"
  },
  "empty": {
    "noDomains": "No domains",
    "noFolders": "No folders found for this account.",
    "noOtherAccount": "No other account available"
  },
  "errors": {
    "accountCreateFailed": "Failed to create the account",
    "accountNotFound": "Account not found",
    "accountUpdateFailed": "Failed to update the account",
    "accountUpdatedForwardsFailed": "The account was updated, but updating the forwards failed",
    "accountsLoadFailed": "Failed to load accounts",
    "autoDeleteThresholdInvalid": "Invalid Auto-Delete Threshold.",
    "autoresponderDeleteFailed": "Could not delete autoresponder",
    "autoresponderSaveFailed": "Could not save the autoresponder.",
    "calendarDeleteFailed": "Could not delete calendar",
    "calendarNotFound": "Calendar not found",
    "calendarSaveFailed": "Could not save the calendar.",
    "cloneCreateFailed": "Could not create the new account.",
    "cloneFailed": "Could not clone the email.",
    "cloneIdResolveFailed": "Account created, but its ID could not be resolved. Retry as 'existing'.",
    "cloneLocalAndDomainRequired": "Enter a local part and domain.",
    "clonePasswordTooShort": "The password must be at least 6 characters.",
    "contactDeleteFailed": "Could not delete contact",
    "contactNotFound": "Contact not found",
    "contactSaveFailed": "Could not save the contact.",
    "copyByRangeFailed": "Could not copy by range",
    "customScoreInvalid": "Invalid custom score.",
    "dateRangeRequired": "You must select a start and end date",
    "defaultAddressLoadFailed": "Could not load Default Address.",
    "defaultAddressSaveFailed": "Could not save Default Address.",
    "deleteByRangeFailed": "Could not delete by range",
    "deleteFailed": "Failed to delete",
    "destEmailInvalid": "Invalid destination email",
    "destinationsInvalidFormat": "One or more destinations have an invalid format.",
    "diskUsageLoadFailed": "Could not load disk usage",
    "domainForwardDeleteFailed": "Could not delete the global forward.",
    "domainForwardsLoadFailed": "Could not load the global forwards.",
    "domainRedirectSaveFailed": "Could not save the global forward.",
    "domainsLoadFailed": "Could not load DNS domains",
    "filterDeleteFailed": "Could not delete the filter",
    "filterNotFound": "Filter not found",
    "filterSaveFailed": "Could not save the filter.",
    "forwardAlreadyExists": "A forward to {destination} already exists",
    "forwardsSaveFailed": "Could not save the forwards on the server",
    "globalFilterDeleteFailed": "Could not delete the global filter.",
    "globalFilterSaveFailed": "Could not save the global filter.",
    "globalFilterTestFailed": "Could not run the test.",
    "globalFiltersLoadFailed": "Could not load the global filters.",
    "indicateTestDestEmail": "Enter the destination email for the test.",
    "localPartInvalid": "The username before @ has an invalid format.",
    "localPartInvalidNoPoint": "The username before @ has an invalid format",
    "mustAddAtLeastOneAction": "You must add at least one action.",
    "mustAddAtLeastOneDestEmail": "You must add at least one destination email.",
    "mustAddAtLeastOneRule": "You must add at least one rule.",
    "mustEnterBody": "You must enter the message content.",
    "mustEnterSubject": "You must enter a subject.",
    "mustEnterTestMessage": "You must enter a test message.",
    "mustEnterValidDestEmail": "You must enter a valid destination email.",
    "mustIndicateCalendarName": "You must enter a calendar name.",
    "mustIndicateContactEmail": "You must enter the contact's email.",
    "mustIndicateFilterName": "You must enter a filter name.",
    "mustIndicateName": "You must enter a name.",
    "mustSelectDomain": "You must select a domain.",
    "mustSelectDomainNoPoint": "You must select a domain",
    "noAutoresponderToDelete": "There is no autoresponder to delete",
    "passwordChangeFailed": "Failed to change the password",
    "quotaInvalid": "Invalid quota",
    "routingLoadFailed": "Could not load the Email Routing configuration.",
    "routingSaveFailed": "Could not save the Email Routing configuration.",
    "saveFailed": "Failed to save",
    "scoreTypesLoadFailed": "Could not load the score types catalog.",
    "selectDestAccount": "Select a destination account",
    "selectValidDomain": "Select a valid domain.",
    "spamFiltersLoadFailed": "Could not load Spam Filters.",
    "spamFiltersSaveFailed": "Could not save Spam Filters configuration.",
    "testEmailFailed": "Test send failed",
    "toggleFailed": "Failed to change status",
    "trackDeliveryLoadFailed": "Could not load Track Delivery."
  },
  "labels": {
    "accountColon": "Account: {address}",
    "activating": "Activating",
    "cloneStartedBg": "Cloning started in the background. We'll notify you when it finishes.",
    "cloning": "Cloning…",
    "currentAccountColon": "Current account: {address}",
    "deactivating": "Deactivating",
    "destEmailForCount": "Destination email for the forward to add to {count} account(s):",
    "loading": "Loading...",
    "newQuotaFor": "New quota in MB for {count} account(s). Use 0 for unlimited.",
    "no": "No",
    "noGlobalLimit": "No global limit",
    "originColon": "Origin: {addr}",
    "sendingTest": "Sending test…",
    "sudoPromptMessage": "Mailbox usage cannot be read without privileges on the server. Enter the sudo password for the SSH user (stored encrypted on the server).",
    "to": "to",
    "total": "Total",
    "unlimited": "Unlimited",
    "yes": "Yes",
    "keepCopy": "Keep a copy"
  },
  "placeholders": {
    "passwordNoChanges": "•••••••• (no changes)",
    "selectDomain": "Select domain...",
    "value": "Value",
    "valueIfApplicable": "Value (if applicable)"
  },
  "status": {
    "active": "Active",
    "deactivated": "Disabled",
    "inactive": "Inactive"
  },
  "titles": {
    "addForward": "Add forward",
    "changeQuota": "Change quota",
    "deleteAccounts": "Delete accounts",
    "deleteAutoresponder": "Delete autoresponder",
    "deleteEncryptionKey": "Delete key",
    "deleteForward": "Delete forward"
  },
  "toasts": {
    "accountActivated": "Account activated",
    "accountCreated": "Account created successfully",
    "accountDeactivated": "Account deactivated",
    "accountDeleted": "Account deleted",
    "accountUpdated": "Account updated ({localPart}@{domain})",
    "archiveDefaultUpdated": "Default archive settings updated.",
    "archiveDomainUpdated": "Archive updated for {domain}.",
    "autoDeleteDisabled": "Auto-Delete disabled",
    "autoDeleteEnabled": "Auto-Delete enabled",
    "autoDeleteUpdated": "Auto-Delete updated",
    "autoresponderDeleted": "Autoresponder deleted",
    "autoresponderSaved": "Autoresponder saved",
    "blacklistUpdated": "Blacklist updated",
    "bulkDeletedCount": "{ok}/{count} account(s) deleted",
    "bulkUpdatedCount": "{ok}/{count} account(s) updated",
    "calculatedScoresUpdated": "Calculated scores updated",
    "calendarCreated": "Calendar created",
    "calendarDeleted": "Calendar deleted",
    "calendarUpdated": "Calendar updated",
    "cloneStarted": "Cloning started — we'll notify you when it finishes",
    "contactCreated": "Contact created",
    "contactDeleted": "Contact deleted",
    "contactUpdated": "Contact updated",
    "defaultAddressUpdated": "Default Address updated for @{domain}",
    "defaultInboxSet": "{address} is now the default address",
    "domainForwardDeleted": "Global forward for @{domain} deleted",
    "emailRoutingUpdated": "Email Routing updated for @{domain}",
    "emailsCopied": "Copied {count} emails from {folder}",
    "emailsDeleted": "Deleted {count} emails from {folder}",
    "filterCreated": "Filter created",
    "filterDeleted": "Filter deleted",
    "filterUpdated": "Filter updated",
    "forwardAddedCount": "Forward added to {ok}/{count} account(s)",
    "forwardDeleted": "Forward deleted",
    "forwardsUpdated": "Forwards updated",
    "globalFilterCreated": "Global filter created",
    "globalFilterDeleted": "Global filter deleted",
    "globalFilterUpdated": "Global filter updated",
    "globalRedirectSaved": "Global forward saved for @{domain}",
    "keyDeleted": "Key deleted.",
    "keyGenerated": "Key generated.",
    "passwordUpdated": "Password updated",
    "publicKeyImported": "Public key imported.",
    "settingsSaved": "Settings saved ✓",
    "spamBoxDisabled": "Spam Box disabled",
    "spamBoxEnabled": "Spam Box enabled",
    "spamBoxUpdated": "Spam Box updated",
    "spamFiltersDisabled": "Spam Filters disabled",
    "spamFiltersEnabled": "Spam Filters enabled",
    "spamThresholdUpdated": "Spam Threshold updated",
    "testEmailSent": "Test email sent ✓",
    "whitelistUpdated": "Whitelist updated"
  },
  "signaturesDrawer": {
    "title": "Signatures",
    "addSignature": "Add signature",
    "close": "Close",
    "tableTitle": "signatures"
  },
  "dataTableTitles": {
    "rules": "rules",
    "publicKeys": "public keys",
    "privateKeys": "private keys",
    "accounts": "accounts",
    "globalFilters": "global filters",
    "contacts": "contacts",
    "calendars": "calendars",
    "filters": "filters"
  },
  "trackColumns": {
    "event": "Event",
    "fromAddress": "From address",
    "sentTime": "Sent time",
    "spamScore": "Spam score",
    "recipient": "Recipient",
    "domain": "Domain",
    "queueId": "ID",
    "result": "Result",
    "actions": "Actions"
  }
} as const;

export default mailPart2;
