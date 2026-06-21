import fs from "fs";

export function renderHTML(scenes, outPath = "output/video.html") {
  const frames = scenes.map((s, i) => `
    <section class="frame" data-index="${i}">
      <div class="title">${s.title}</div>
      <div class="body">${s.body || ""}</div>
    </section>
  `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">

<style>
body {
  margin: 0;
  background: #0b0b0b;
  color: white;
  font-family: sans-serif;
}

.frame {
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 80px;
  border-bottom: 1px solid #222;
}

.title {
  font-size: 64px;
  font-weight: bold;
}

.body {
  margin-top: 20px;
  font-size: 28px;
  color: #aaa;
}
</style>

</head>
<body>

${frames}

</body>
</html>
`;

  fs.writeFileSync(outPath, html);
}
