const deps = {
  "banner": {
    "title": "Required components not detected",
    "description": "This module needs system packages on the connected server. The server's package manager will be run with elevated privileges.",
    "btnInstall": "Install now",
    "btnInstallAll": "Install all",
    "installing": "Installing… this can take a few minutes.",
    "success": "Components installed successfully.",
    "optionalTitle": "Optional components",
    "optionalDescription": "These components enable extra features of this module.",
    "statusInstalled": "Installed",
    "statusMissing": "Not installed",
    "statusOptional": "Optional",
    "modalTitle": "Install components",
    "modalDescription": "The package manager output will appear below.",
    "checkError": "Could not verify the module's components.",
    "oneOfTitle": "At least one of these components is required",
    "oneOfDescription": "Install one of the following components to enable this module."
  }
} as const;

export default deps;
