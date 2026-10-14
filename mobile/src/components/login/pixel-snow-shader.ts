// Lightweight native snow: three drifting layers instead of per-pixel 3D ray marching.
export const pixelSnowShader = `
uniform float uTime;
uniform float2 uResolution;
uniform float uFlakeSize;
uniform float uMinFlakeSize;
uniform float uPixelResolution;
uniform float uSpeed;
uniform float uDepthFade;
uniform float uFarPlane;
uniform float3 uColor;
uniform float uBrightness;
uniform float uGamma;
uniform float uDensity;
uniform float uVariant;
uniform float uDirection;
uniform float uOpacity;

float3 hashCell(float2 cell) {
  float3 p = fract(float3(cell.x, cell.y, cell.x) * float3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.xxy + p.yzz) * p.zyx);
}

float layer(float2 point, float cellSize, float speed, float seed) {
  float2 wind = float2(cos(uDirection), sin(uDirection));
  float2 grid = (point - wind * uTime * uSpeed * speed) / cellSize;
  float2 cell = floor(grid);
  float3 random = hashCell(cell + seed);
  if (random.z > uDensity) return 0.0;
  // Keep flakes inside their cell: no clipped edges or popping as they drift.
  float2 center = 0.18 + random.xy * 0.64;
  float2 delta = (fract(grid) - center) * cellSize;
  float size = clamp(max(uMinFlakeSize, uFlakeSize * uResolution.x) * (0.45 + random.z), 0.7, cellSize * 0.1);
  float distance = max(abs(delta.x), abs(delta.y));
  if (uVariant > 0.5 && uVariant < 1.5) distance = length(delta);
  else if (uVariant > 1.5) distance = min(max(abs(delta.x) * 0.38, abs(delta.y)), max(abs(delta.x), abs(delta.y) * 0.38));
  return 1.0 - smoothstep(size - 0.6, size + 0.6, distance);
}

half4 main(float2 coordinate) {
  float scale = max(0.7, uResolution.x / 390.0);
  float spacing = clamp(uResolution.x / uPixelResolution, 1.0, 4.0);
  float depth = clamp(uFarPlane / uDepthFade, 1.0, 4.0);
  float flakes = layer(coordinate, 42.0 * scale * spacing, 11.0, 19.0) * 0.24
               + layer(coordinate, 68.0 * scale * spacing, 20.0, 47.0) * 0.48
               + layer(coordinate, 96.0 * scale * spacing, 32.0, 83.0) * 0.74;
  float alpha = clamp(pow(flakes * uBrightness, max(0.7, uGamma)) * uOpacity * min(1.0, depth * 0.5), 0.0, 1.0);
  return half4(uColor * alpha, alpha);
}
`;
