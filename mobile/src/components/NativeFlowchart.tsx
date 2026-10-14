import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Svg, { Path, Defs, Marker, Polygon } from "react-native-svg";
import { parseFlowchart } from "../lib/native-flowchart";
import { useTheme } from "../hooks/useTheme";
import { getThemeTokens } from "../theme/colors";
import { Button } from "./ui/Button";
export function NativeFlowchart({ source }: { source: string }) {
  const colors = getThemeTokens(useTheme().theme === "dark"), graph = parseFlowchart(source);
  const [showSource, setShowSource] = useState(false);
  const width = 580, height = Math.max(150, Math.ceil(graph.nodes.length / 2) * 140);
  const positions = new Map(graph.nodes.map((node, index) => [node.id, { x: 24 + (index % 2) * 290, y: 24 + Math.floor(index / 2) * 140 }]));
  return <View style={{ gap: 8 }}>{graph.nodes.length ? <ScrollView horizontal><View style={{ width, height }}><Svg width={width} height={height} style={{position:"absolute"}}><Defs><Marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><Polygon points="0,0 10,5 0,10" fill={colors.brand} /></Marker></Defs>{graph.edges.map((edge, index) => { const from = positions.get(edge.from)!, to = positions.get(edge.to)!; const sameRow = from.y === to.y; const x1 = from.x + (sameRow && from.x > to.x ? 0 : sameRow ? 240 : 120), y1 = from.y + (sameRow ? 40 : 80); const x2 = to.x + (sameRow && from.x > to.x ? 240 : sameRow ? 0 : 120), y2 = to.y + (sameRow ? 40 : 0); return <Path key={index} d={`M ${x1} ${y1} C ${x1} ${sameRow ? y1 : y1 + 25}, ${x2} ${sameRow ? y2 : y2 - 25}, ${x2} ${y2}`} stroke={colors.brand} strokeWidth={2} fill="none" markerEnd="url(#arrow)" />; })}</Svg>{graph.nodes.map(node => { const pos = positions.get(node.id)!; return <View key={node.id} style={{ position:"absolute",left:pos.x,top:pos.y,width:240,minHeight:80,padding:12,borderRadius:12,borderWidth:1,borderColor:colors.brand,backgroundColor:colors.bgCardSolid,justifyContent:"center" }}><Text style={{color:colors.textPrimary,fontWeight:"600",textAlign:"center"}}>{node.label}</Text></View>; })}</View></ScrollView> : <Text style={{color:colors.textMuted}}>El diagrama no contiene nodos de flujo reconocibles.</Text>}{graph.edges.filter(edge => edge.label).map((edge,index) => <Text key={index} style={{color:colors.textSecondary}}>{positions.has(edge.from) ? graph.nodes.find(node=>node.id===edge.from)?.label : edge.from} → {graph.nodes.find(node=>node.id===edge.to)?.label}: {edge.label}</Text>)}<Button variant="ghost" label={showSource ? "Ocultar código del diagrama" : "Ver código del diagrama"} onPress={()=>setShowSource(!showSource)} />{showSource && <Text selectable style={{color:colors.textSecondary,fontFamily:"monospace"}}>{source}</Text>}</View>;
}
