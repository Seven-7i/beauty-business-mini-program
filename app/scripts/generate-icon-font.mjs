import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import svg2ttf from "svg2ttf";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const APP_DIRECTORY = resolve(SCRIPT_DIRECTORY, "..");
const FONT_OUTPUT = resolve(
  APP_DIRECTORY,
  "src/static/fonts/zhuangyue-icons.ttf",
);
const MAP_OUTPUT = resolve(
  APP_DIRECTORY,
  "src/features/shared/icon-font.generated.ts",
);

const STROKE_WIDTH = 52;
const HALF_STROKE = STROKE_WIDTH / 2;
const CURVE_CONSTANT = 0.5522847498;

class GlyphPath {
  commands = [];

  moveTo(x, y) {
    this.commands.push(`M${format(x)} ${format(y)}`);
  }

  lineTo(x, y) {
    this.commands.push(`L${format(x)} ${format(y)}`);
  }

  curveTo(x1, y1, x2, y2, x, y) {
    this.commands.push(
      `C${format(x1)} ${format(y1)} ${format(x2)} ${format(y2)} ${format(x)} ${format(y)}`,
    );
  }

  close() {
    this.commands.push("Z");
  }

  toString() {
    return this.commands.join(" ");
  }
}

function format(value) {
  return Number(value.toFixed(2));
}

function addPolygon(path, points, reverse = false) {
  const ordered = reverse ? [...points].reverse() : points;
  path.moveTo(ordered[0][0], ordered[0][1]);
  for (const [x, y] of ordered.slice(1)) {
    path.lineTo(x, y);
  }
  path.close();
}

function addEllipse(path, centerX, centerY, radiusX, radiusY, reverse = false) {
  const horizontal = radiusX * CURVE_CONSTANT;
  const vertical = radiusY * CURVE_CONSTANT;
  path.moveTo(centerX + radiusX, centerY);
  if (reverse) {
    path.curveTo(
      centerX + radiusX,
      centerY - vertical,
      centerX + horizontal,
      centerY - radiusY,
      centerX,
      centerY - radiusY,
    );
    path.curveTo(
      centerX - horizontal,
      centerY - radiusY,
      centerX - radiusX,
      centerY - vertical,
      centerX - radiusX,
      centerY,
    );
    path.curveTo(
      centerX - radiusX,
      centerY + vertical,
      centerX - horizontal,
      centerY + radiusY,
      centerX,
      centerY + radiusY,
    );
    path.curveTo(
      centerX + horizontal,
      centerY + radiusY,
      centerX + radiusX,
      centerY + vertical,
      centerX + radiusX,
      centerY,
    );
  } else {
    path.curveTo(
      centerX + radiusX,
      centerY + vertical,
      centerX + horizontal,
      centerY + radiusY,
      centerX,
      centerY + radiusY,
    );
    path.curveTo(
      centerX - horizontal,
      centerY + radiusY,
      centerX - radiusX,
      centerY + vertical,
      centerX - radiusX,
      centerY,
    );
    path.curveTo(
      centerX - radiusX,
      centerY - vertical,
      centerX - horizontal,
      centerY - radiusY,
      centerX,
      centerY - radiusY,
    );
    path.curveTo(
      centerX + horizontal,
      centerY - radiusY,
      centerX + radiusX,
      centerY - vertical,
      centerX + radiusX,
      centerY,
    );
  }
  path.close();
}

function addCircle(path, centerX, centerY, radius, reverse = false) {
  addEllipse(path, centerX, centerY, radius, radius, reverse);
}

function addRing(path, centerX, centerY, outerRadius, thickness = STROKE_WIDTH) {
  addCircle(path, centerX, centerY, outerRadius);
  addCircle(path, centerX, centerY, outerRadius - thickness, true);
}

function addEllipseRing(
  path,
  centerX,
  centerY,
  radiusX,
  radiusY,
  thickness = STROKE_WIDTH,
) {
  addEllipse(path, centerX, centerY, radiusX, radiusY);
  addEllipse(
    path,
    centerX,
    centerY,
    radiusX - thickness,
    radiusY - thickness,
    true,
  );
}

function addStroke(path, start, end, width = STROKE_WIDTH, round = true) {
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  const length = Math.hypot(deltaX, deltaY);
  const half = width / 2;
  const normalX = (-deltaY / length) * half;
  const normalY = (deltaX / length) * half;
  addPolygon(path, [
    [start[0] + normalX, start[1] + normalY],
    [end[0] + normalX, end[1] + normalY],
    [end[0] - normalX, end[1] - normalY],
    [start[0] - normalX, start[1] - normalY],
  ]);
  if (round) {
    addCircle(path, start[0], start[1], half);
    addCircle(path, end[0], end[1], half);
  }
}

function addPolyline(path, points, closed = false, width = STROKE_WIDTH) {
  const segmentCount = closed ? points.length : points.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    addStroke(path, points[index], points[(index + 1) % points.length], width);
  }
}

function addArc(
  path,
  centerX,
  centerY,
  radius,
  startDegrees,
  endDegrees,
  width = STROKE_WIDTH,
) {
  const steps = Math.max(8, Math.ceil(Math.abs(endDegrees - startDegrees) / 12));
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const degrees = startDegrees + ((endDegrees - startDegrees) * index) / steps;
    const radians = (degrees * Math.PI) / 180;
    return [
      centerX + Math.cos(radians) * radius,
      centerY + Math.sin(radians) * radius,
    ];
  });
  addPolyline(path, points, false, width);
  return points;
}

function createHome() {
  const path = new GlyphPath();
  addPolyline(path, [
    [170, 470],
    [500, 800],
    [830, 470],
  ]);
  addPolyline(
    path,
    [
      [240, 500],
      [240, 120],
      [760, 120],
      [760, 500],
    ],
    false,
  );
  addPolyline(path, [
    [420, 120],
    [420, 350],
    [580, 350],
    [580, 120],
  ]);
  return path;
}

function createAccount() {
  const path = new GlyphPath();
  addRing(path, 500, 650, 150);
  addArc(path, 500, 180, 310, 18, 162);
  return path;
}

function createStorage() {
  const path = new GlyphPath();
  addEllipseRing(path, 500, 700, 300, 105);
  addEllipseRing(path, 500, 500, 300, 105);
  addEllipseRing(path, 500, 300, 300, 105);
  addStroke(path, [200, 300], [200, 700]);
  addStroke(path, [800, 300], [800, 700]);
  return path;
}

function createBackup() {
  const path = new GlyphPath();
  addPolyline(
    path,
    [
      [210, 660],
      [790, 660],
      [790, 800],
      [210, 800],
    ],
    true,
  );
  addPolyline(
    path,
    [
      [260, 640],
      [260, 120],
      [740, 120],
      [740, 640],
    ],
    true,
  );
  addStroke(path, [415, 420], [585, 420]);
  return path;
}

function createHistory() {
  const path = new GlyphPath();
  addRing(path, 500, 450, 330);
  addStroke(path, [500, 450], [500, 655]);
  addStroke(path, [500, 450], [650, 315]);
  addCircle(path, 500, 450, HALF_STROKE + 4);
  return path;
}

function createFileRestore() {
  const path = new GlyphPath();
  addPolyline(
    path,
    [
      [250, 120],
      [250, 800],
      [535, 800],
      [750, 585],
      [750, 120],
    ],
    true,
  );
  addPolyline(path, [
    [535, 800],
    [535, 585],
    [750, 585],
  ]);
  addStroke(path, [500, 520], [500, 250]);
  addPolyline(path, [
    [390, 360],
    [500, 250],
    [610, 360],
  ]);
  return path;
}

function createShield() {
  const path = new GlyphPath();
  addPolyline(
    path,
    [
      [500, 830],
      [790, 700],
      [750, 350],
      [650, 180],
      [500, 70],
      [350, 180],
      [250, 350],
      [210, 700],
    ],
    true,
  );
  addStroke(path, [500, 590], [500, 330]);
  addCircle(path, 500, 215, 35);
  return path;
}

function createModules() {
  const path = new GlyphPath();
  const squares = [
    [170, 500, 430, 760],
    [570, 500, 830, 760],
    [170, 100, 430, 360],
    [570, 100, 830, 360],
  ];
  for (const [left, bottom, right, top] of squares) {
    addPolyline(
      path,
      [
        [left, bottom],
        [left, top],
        [right, top],
        [right, bottom],
      ],
      true,
    );
  }
  return path;
}

function createInfo() {
  const path = new GlyphPath();
  addRing(path, 500, 450, 330);
  addStroke(path, [500, 420], [500, 235]);
  addCircle(path, 500, 590, 38);
  return path;
}

function createChevronRight() {
  const path = new GlyphPath();
  addPolyline(path, [
    [380, 680],
    [620, 450],
    [380, 220],
  ]);
  return path;
}

function addCalendarFrame(path) {
  addPolyline(
    path,
    [
      [200, 150],
      [200, 720],
      [800, 720],
      [800, 150],
    ],
    true,
  );
  addStroke(path, [200, 565], [800, 565]);
  addStroke(path, [350, 790], [350, 660]);
  addStroke(path, [650, 790], [650, 660]);
}

function createAppointment() {
  const path = new GlyphPath();
  addCalendarFrame(path);
  addPolyline(path, [
    [355, 335],
    [455, 235],
    [650, 430],
  ]);
  return path;
}

function createCustomer() {
  return createAccount();
}

function createProjects() {
  const path = new GlyphPath();
  addRing(path, 360, 590, 125);
  addRing(path, 640, 590, 125);
  addRing(path, 360, 310, 125);
  addRing(path, 640, 310, 125);
  return path;
}

function createInventory() {
  return createBackup();
}

function createCalendar() {
  const path = new GlyphPath();
  addCalendarFrame(path);
  for (const [x, y] of [
    [350, 430],
    [500, 430],
    [650, 430],
    [350, 275],
    [500, 275],
    [650, 275],
  ]) {
    addCircle(path, x, y, 34);
  }
  return path;
}

function createReports() {
  const path = new GlyphPath();
  addStroke(path, [210, 160], [790, 160]);
  addPolyline(
    path,
    [
      [270, 160],
      [270, 390],
      [390, 390],
      [390, 160],
    ],
    true,
  );
  addPolyline(
    path,
    [
      [440, 160],
      [440, 570],
      [560, 570],
      [560, 160],
    ],
    true,
  );
  addPolyline(
    path,
    [
      [610, 160],
      [610, 760],
      [730, 760],
      [730, 160],
    ],
    true,
  );
  return path;
}

function createData() {
  return createStorage();
}

const iconDefinitions = [
  ["home", 0xe001, createHome],
  ["account", 0xe002, createAccount],
  ["storage", 0xe003, createStorage],
  ["backup", 0xe004, createBackup],
  ["history", 0xe005, createHistory],
  ["file-restore", 0xe006, createFileRestore],
  ["shield", 0xe007, createShield],
  ["modules", 0xe008, createModules],
  ["info", 0xe009, createInfo],
  ["chevron-right", 0xe00a, createChevronRight],
  ["appointment", 0xe00b, createAppointment],
  ["customer", 0xe00c, createCustomer],
  ["projects", 0xe00d, createProjects],
  ["inventory", 0xe00e, createInventory],
  ["calendar", 0xe00f, createCalendar],
  ["reports", 0xe010, createReports],
  ["data", 0xe011, createData],
];

const glyphMarkup = iconDefinitions
  .map(([name, codePoint, createPath]) => {
    const unicode = `&#x${codePoint.toString(16).toUpperCase()};`;
    return `<glyph glyph-name="${name}" unicode="${unicode}" horiz-adv-x="1000" d="${createPath()}" />`;
  })
  .join("\n");

const svgFont = `<?xml version="1.0" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg">
  <defs>
    <font id="ZhuangYueIcons" horiz-adv-x="1000">
      <font-face font-family="ZhuangYueIcons" units-per-em="1000" ascent="950" descent="-50" />
      <missing-glyph horiz-adv-x="1000" />
${glyphMarkup}
    </font>
  </defs>
</svg>`;

const generatedMap = `// Generated by scripts/generate-icon-font.mjs. Do not edit by hand.\nexport const APP_ICON_GLYPHS = {\n${iconDefinitions
  .map(
    ([name, codePoint]) =>
      `  "${name}": "\\u${codePoint.toString(16).toUpperCase().padStart(4, "0")}",`,
  )
  .join("\n")}\n} as const;\n\nexport type AppIconName = keyof typeof APP_ICON_GLYPHS;\n`;

const ttf = svg2ttf(svgFont, {
  copyright: "Copyright 2026 ZhuangYue Space",
  description: "Local semantic interface icons for ZhuangYue Space",
  ts: 0,
  version: "1.0",
});

mkdirSync(dirname(FONT_OUTPUT), { recursive: true });
writeFileSync(FONT_OUTPUT, Buffer.from(ttf.buffer));
writeFileSync(MAP_OUTPUT, generatedMap, "utf8");

console.log(`Generated ${iconDefinitions.length} glyphs (${ttf.buffer.byteLength} bytes).`);
