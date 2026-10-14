import React from "react";
import { Image } from "react-native";
export function PanelLogo() {
  return (
    <Image
      source={require("../../../assets/logo2.png")}
      style={{ width: 28, height: 28 }}
      resizeMode="contain"
    />
  );
}
