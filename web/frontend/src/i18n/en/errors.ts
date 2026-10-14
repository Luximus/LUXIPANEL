const errors = {
  "networkError": {
    "serverError": "The server returned an error {status} (the operation may have timed out).",
    "invalidResponse": "Invalid response from the server.",
    "connectionFailed": "Could not connect to the server. Check your connection and try again.",
    "targetScopeChanged": "The selected server changed; reload the view.",
    "bridgeSessionRequired": "Select or reconnect a server to continue."
  },
  "error400": {
    "code": "400",
    "title": "Invalid request",
    "description": "The submitted request contains invalid parameters. Please check your data and try again."
  },
  "error401": {
    "code": "401",
    "title": "Unauthorized",
    "description": "You need to sign in to access this resource. Please sign in."
  },
  "error403": {
    "code": "403",
    "title": "Access forbidden",
    "description": "You do not have permission to access this resource."
  },
  "error404": {
    "code": "404",
    "title": "Page not found",
    "description": "The path you are looking for does not exist or has been moved. Check the URL or go back to the home page."
  },
  "error500": {
    "code": "500",
    "title": "Internal server error",
    "description": "Something went wrong on our server. We are working to fix it. Please try again later."
  },
  "error503": {
    "code": "503",
    "title": "Service unavailable",
    "description": "The server is under maintenance or overloaded. Please try again later."
  },
  "home": "Go to Home",
  "back": "Go back",
  "backToServers": "Back to servers"
} as const;

export default errors;
