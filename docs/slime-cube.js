const canvas = document.getElementById("slimeCanvas");
const ctx = canvas.getContext("2d");
const bounceButton = document.getElementById("bounceButton");

const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
const pointer = { x: 0, y: 0, active: false };
const camera = { distance: 860, focal: 760 };
const cubeState = {
  rotationX: -0.45,
  rotationY: 0.72,
  targetX: -0.45,
  targetY: 0.72,
  wobble: 0,
  wobbleVelocity: 0,
  pulse: 0,
  pulseVelocity: 0,
  hover: false,
};

function resize() {
  const bounds = canvas.getBoundingClientRect();
  canvas.width = Math.round(bounds.width * DPR);
  canvas.height = Math.round(bounds.height * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rotatePoint(point, rx, ry) {
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);

  const x1 = point.x * cosY - point.z * sinY;
  const z1 = point.x * sinY + point.z * cosY;
  const y1 = point.y;

  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;

  return { x: x1, y: y2, z: z2 };
}

function projectPoint(point, centerX, centerY) {
  const depth = camera.distance - point.z;
  const perspective = camera.focal / depth;
  return {
    x: centerX + point.x * perspective,
    y: centerY + point.y * perspective,
    z: point.z,
    scale: perspective,
  };
}

function createCube(size) {
  const s = size / 2;
  const vertices = [
    { x: -s, y: -s, z: -s },
    { x: s, y: -s, z: -s },
    { x: s, y: s, z: -s },
    { x: -s, y: s, z: -s },
    { x: -s, y: -s, z: s },
    { x: s, y: -s, z: s },
    { x: s, y: s, z: s },
    { x: -s, y: s, z: s },
  ];

  const faces = [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [2, 3, 7, 6],
    [1, 2, 6, 5],
    [0, 3, 7, 4],
  ];

  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  return { vertices, faces, edges };
}

const outerCube = createCube(240);
const innerCube = createCube(92);

function getDeformation() {
  const amplitude = cubeState.pulse;
  const squash = Math.max(0, amplitude);
  const stretch = Math.max(0, -amplitude);

  return {
    scaleX: 1 + squash * 0.22 - stretch * 0.08,
    scaleY: 1 - squash * 0.28 + stretch * 0.22,
    scaleZ: 1 + squash * 0.16 - stretch * 0.04,
    lift: -squash * 46 + stretch * 18,
    roll: cubeState.wobble * 0.07,
  };
}

function transformVertices(cube, centerX, centerY, multipliers) {
  const deform = getDeformation();
  const rx = cubeState.rotationX + deform.roll;
  const ry = cubeState.rotationY;

  return cube.vertices.map((vertex) => {
    const scaled = {
      x: vertex.x * deform.scaleX * multipliers.x,
      y: vertex.y * deform.scaleY * multipliers.y + deform.lift,
      z: vertex.z * deform.scaleZ * multipliers.z,
    };
    const rotated = rotatePoint(scaled, rx, ry);
    return projectPoint(rotated, centerX, centerY);
  });
}

function drawFace(points, indices, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(points[indices[0]].x, points[indices[0]].y);
  for (let i = 1; i < indices.length; i += 1) {
    ctx.lineTo(points[indices[i]].x, points[indices[i]].y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function drawEdges(points, edges, stroke, width) {
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  for (const [a, b] of edges) {
    ctx.beginPath();
    ctx.moveTo(points[a].x, points[a].y);
    ctx.lineTo(points[b].x, points[b].y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGlow(centerX, centerY) {
  const gradient = ctx.createRadialGradient(centerX, centerY + 60, 16, centerX, centerY + 60, 240);
  gradient.addColorStop(0, "rgba(103, 232, 249, 0.30)");
  gradient.addColorStop(1, "rgba(103, 232, 249, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 132, 210, 54, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGrid(width, height) {
  ctx.save();
  ctx.strokeStyle = "rgba(103, 232, 249, 0.08)";
  ctx.lineWidth = 1;
  for (let y = 36; y < height; y += 36) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let x = 36; x < width; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.restore();
}

function drawScene() {
  const width = canvas.width / DPR;
  const height = canvas.height / DPR;

  ctx.clearRect(0, 0, width, height);
  drawGrid(width, height);

  const centerX = width / 2;
  const centerY = height / 2 + 18;
  drawGlow(centerX, centerY);

  const outerPoints = transformVertices(outerCube, centerX, centerY, { x: 1, y: 1, z: 1 });
  const innerPoints = transformVertices(innerCube, centerX, centerY, { x: 1.02, y: 1.02, z: 1.02 });

  const faceOrder = outerCube.faces
    .map((face, index) => ({
      face,
      index,
      depth: face.reduce((sum, vertexIndex) => sum + outerPoints[vertexIndex].z, 0) / face.length,
    }))
    .sort((a, b) => a.depth - b.depth);

  const outerFill = [
    "rgba(56, 189, 248, 0.16)",
    "rgba(125, 211, 252, 0.10)",
    "rgba(34, 211, 238, 0.18)",
    "rgba(125, 211, 252, 0.14)",
    "rgba(14, 165, 233, 0.22)",
    "rgba(103, 232, 249, 0.10)",
  ];

  const innerFill = [
    "#082f49",
    "#0ea5e9",
    "#38bdf8",
    "#155e75",
    "#67e8f9",
    "#0891b2",
  ];

  for (const item of faceOrder) {
    drawFace(
      outerPoints,
      item.face,
      outerFill[item.index],
      cubeState.hover ? "rgba(186, 230, 253, 0.52)" : "rgba(186, 230, 253, 0.34)"
    );
  }

  const innerOrder = innerCube.faces
    .map((face, index) => ({
      face,
      index,
      depth: face.reduce((sum, vertexIndex) => sum + innerPoints[vertexIndex].z, 0) / face.length,
    }))
    .sort((a, b) => a.depth - b.depth);

  for (const item of innerOrder) {
    drawFace(
      innerPoints,
      item.face,
      innerFill[item.index],
      "rgba(224, 242, 254, 0.42)"
    );
  }

  drawEdges(outerPoints, outerCube.edges, cubeState.hover ? "rgba(224, 242, 254, 0.8)" : "rgba(224, 242, 254, 0.56)", 1.5);
  drawEdges(innerPoints, innerCube.edges, "rgba(255, 255, 255, 0.3)", 1.15);

  ctx.save();
  ctx.fillStyle = "rgba(224, 242, 254, 0.88)";
  ctx.font = '700 14px "JetBrains Mono", Consolas, monospace';
  ctx.textAlign = "center";
  ctx.fillText("move mouse / click cube / bounce like slime", centerX, height - 34);
  ctx.restore();
}

function update() {
  const idleTime = performance.now() * 0.0012;
  const idleY = Math.sin(idleTime) * 0.18;
  const idleX = Math.cos(idleTime * 0.9) * 0.12;

  cubeState.targetY = idleY;
  cubeState.targetX = -0.42 + idleX * 0.35;

  if (pointer.active) {
    const bounds = canvas.getBoundingClientRect();
    const dx = (pointer.x - bounds.width / 2) / bounds.width;
    const dy = (pointer.y - bounds.height / 2) / bounds.height;
    cubeState.targetY += clamp(dx, -0.42, 0.42) * 1.35;
    cubeState.targetX += clamp(dy, -0.38, 0.38) * 1.0;
  }

  cubeState.rotationX = lerp(cubeState.rotationX, cubeState.targetX, 0.08);
  cubeState.rotationY = lerp(cubeState.rotationY, cubeState.targetY + 0.72, 0.08);

  cubeState.pulseVelocity += (-cubeState.pulse * 0.15) - cubeState.pulseVelocity * 0.09;
  cubeState.pulse += cubeState.pulseVelocity;

  cubeState.wobbleVelocity += (-cubeState.wobble * 0.18) - cubeState.wobbleVelocity * 0.11;
  cubeState.wobble += cubeState.wobbleVelocity;

  drawScene();
  requestAnimationFrame(update);
}

function triggerBounce() {
  cubeState.pulseVelocity -= 0.22;
  cubeState.wobbleVelocity += (Math.random() - 0.5) * 0.18;
}

function pointerToLocal(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
    width: bounds.width,
    height: bounds.height,
  };
}

function isInsideCube(local) {
  const cx = local.width / 2;
  const cy = local.height / 2 + 18;
  const radiusX = Math.min(local.width * 0.22, 240);
  const radiusY = Math.min(local.height * 0.26, 250);
  const dx = (local.x - cx) / radiusX;
  const dy = (local.y - cy) / radiusY;
  return dx * dx + dy * dy <= 1.0;
}

canvas.addEventListener("pointermove", (event) => {
  const local = pointerToLocal(event);
  pointer.x = local.x;
  pointer.y = local.y;
  pointer.active = true;
  cubeState.hover = isInsideCube(local);
  canvas.style.cursor = cubeState.hover ? "pointer" : "default";
});

canvas.addEventListener("pointerleave", () => {
  pointer.active = false;
  cubeState.hover = false;
  canvas.style.cursor = "default";
});

canvas.addEventListener("pointerdown", (event) => {
  const local = pointerToLocal(event);
  if (isInsideCube(local)) {
    triggerBounce();
  }
});

bounceButton.addEventListener("click", triggerBounce);
window.addEventListener("resize", resize);

resize();
update();
