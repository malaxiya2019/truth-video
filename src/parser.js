import fs from "fs";

export function parseMarkdown(input) {
  // 接受文件路径或直接 Markdown 字符串
  let text;
  if (fs.existsSync(input)) {
    text = fs.readFileSync(input, "utf8");
  } else if (typeof input === "string" && input.includes("#")) {
    text = input;
  } else if (typeof input === "string") {
    try { text = fs.readFileSync(input, "utf8"); } catch { text = input; }
  } else {
    text = "";
  }

  const scenes = [];

  const parts = text.split("## ");

  const title = parts[0]
    .replace("# ", "")
    .trim();

  scenes.push({
    type: "cover",
    title,
    body: "",
    index: 0
  });

  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].trim();
    if (!block) continue;

    const lines = block.split("\n");

    scenes.push({
      type: "slide",
      title: lines[0].trim(),
      body: lines.slice(1).join(" ").trim(),
      index: i
    });
  }

  return scenes;
}
