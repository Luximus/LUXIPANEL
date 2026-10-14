import "react-native-gesture-handler";
import { registerRootComponent } from "expo";
import { installDevelopmentErrorLogging } from "./src/lib/development-errors";

installDevelopmentErrorLogging();
// Require after installing the handler so startup imports are reported too.
const App = __DEV__
  ? require("./src/lib/development-startup").createDevelopmentRoot(() => require("./App").default)
  : require("./App").default;

registerRootComponent(App);
