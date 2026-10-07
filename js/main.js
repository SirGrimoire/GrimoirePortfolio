(() => {
  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(pointer: fine)").matches;
  const stage = $("#stage"), canvas = $("#gl"), copy = $(".hero-copy"), clamp = (v) => Math.min(.98, Math.max(.02, v));
  $("#yr").textContent = new Date().getFullYear();

  // Title letters: entrance animation + they lean toward the cursor.
  const h1 = $("#name");
  h1.innerHTML = [...h1.textContent].map((c, i) => `<span class="ch" aria-hidden="true" style="--i:${i}">${c}</span>`).join("");
  const letters = [...h1.children].map((el) => ({ el, x: 0, y: 0, r: 0, s: 1 }));

  // Palettes of traditional Japanese colour names (hex values are approximations).
  const palettes = [
    ["Dusk", [["Ruri", "#4F7CAC"], ["Tsutsuji", "#C77DA3"], ["Kaki", "#E8A87C"], ["Kakitsubata", "#6C5B9E"]]],
    ["Sakura", [["Nadeshiko", "#DC9FB4"], ["Fuji", "#8B81C3"], ["Ume", "#C4687F"], ["Gunjo", "#5A79BA"]]],
    ["Aurora", [["Wakatake", "#5CB28F"], ["Asagi", "#3A9EAE"], ["Kikyo", "#6A62B8"], ["Mizuasagi", "#7FC4C8"]]],
    ["Ember", [["Akane", "#B7282E"], ["Daidai", "#E9792F"], ["Yamabuki", "#F2B138"], ["Budo", "#6D2E5B"]]],
  ];
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const pos = [[.80, .22], [.58, .55], [.88, .72], [.30, .28]];
  const mouse = { x: .5, y: .5, tx: .5, ty: .5, cx: 0, cy: 0, in: false };
  const rip = { x: .5, y: .5, t0: -99 };
  let visible = true, running = false, ready = false;

  const spots = pos.map(([x, y], i) => {
    const el = document.createElement("div");
    el.className = "spot";
    el.innerHTML = `<button class="ring" type="button"></button><span class="chip"><i></i><b></b> <small></small></span>`;
    stage.append(el);
    const s = { el, i, tx: x, ty: y, cx: x, cy: y, col: [0, 0, 0], tcol: [0, 0, 0], ring: el.firstChild, name: el.querySelector("b"), hex: el.querySelector("small") };
    const move = (e) => { const r = stage.getBoundingClientRect(); s.tx = clamp((e.clientX - r.left) / r.width); s.ty = clamp((e.clientY - r.top) / r.height); wake(); };
    s.ring.addEventListener("pointerdown", (e) => { s.ring.setPointerCapture(e.pointerId); s.ring.classList.add("drag"); move(e); });
    s.ring.addEventListener("pointermove", (e) => s.ring.classList.contains("drag") && move(e));
    ["pointerup", "pointercancel"].forEach((ev) => s.ring.addEventListener(ev, () => s.ring.classList.remove("drag")));
    s.ring.addEventListener("keydown", (e) => {
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!k) return; e.preventDefault(); s.tx = clamp(s.tx + k[0] * .04); s.ty = clamp(s.ty + k[1] * .04); wake();
    });
    return s;
  });

  // Palette swatches: colours blend smoothly to the chosen preset.
  const bar = document.createElement("div");
  bar.className = "swatches"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "Colour palettes");
  stage.append(bar);
  const setPalette = (n, first) => {
    palettes[n][1].forEach(([name, hex], i) => {
      const s = spots[i]; s.tcol = rgb(hex); if (first) s.col = s.tcol.slice();
      s.el.style.setProperty("--c", hex); s.name.textContent = name; s.hex.textContent = hex;
      s.ring.setAttribute("aria-label", `Move ${name} colour. Drag or use arrow keys.`);
    });
    [...bar.children].forEach((b, i) => b.setAttribute("aria-pressed", i === n));
    wake();
  };
  palettes.forEach(([name, cols], n) => {
    const b = document.createElement("button");
    b.className = "sw"; b.type = "button"; b.setAttribute("aria-label", `${name} palette`);
    cols.forEach(([, hex], i) => b.style.setProperty(`--c${i + 1}`, hex));
    b.addEventListener("click", () => setPalette(n));
    bar.append(b);
  });
  setPalette(0, true);

  stage.addEventListener("pointermove", (e) => {
    const r = stage.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left) / r.width; mouse.ty = (e.clientY - r.top) / r.height; mouse.cx = e.clientX; mouse.cy = e.clientY; wake();
  });
  stage.addEventListener("pointerenter", () => (mouse.in = true));
  stage.addEventListener("pointerleave", () => (mouse.in = false));
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".ring,.swatches")) return;
    const r = stage.getBoundingClientRect();
    rip.x = (e.clientX - r.left) / r.width; rip.y = (e.clientY - r.top) / r.height; rip.t0 = (performance.now() / 1000) % 600; wake();
  });

  // WebGL: domain-warped blend of the colour spots, pointer lens, click ripples and grain.
  const gl = canvas.getContext("webgl", { antialias: false, powerPreference: "low-power" });
  let draw = null;
  if (gl) {
    const vs = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
    const fs = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 r,m,p[4];uniform vec3 c[4],rp;uniform float t;
float h(vec2 x){return fract(sin(dot(x,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  float asp=r.x/r.y;vec2 A=vec2(asp,1.);vec2 uv=gl_FragCoord.xy/r;uv.y=1.-uv.y;vec2 q=uv*A;
  vec2 pm=q-m*A;q+=pm*.10*exp(-dot(pm,pm)*9.);
  float rr=t-rp.z;vec2 pr=q-rp.xy*A;float dr=length(pr);
  float env=exp(-rr*1.8)*exp(-(dr-rr*.55)*(dr-rr*.55)*60.);
  q+=normalize(pr+1e-4)*.06*sin((dr-rr*.55)*30.)*env;
  for(int i=0;i<3;i++){q+=.12*vec2(sin(q.y*3.+t*.5+float(i)*1.7),cos(q.x*3.+t*.4+float(i)*2.3));}
  vec3 col=vec3(0.);float ws=0.;
  for(int i=0;i<4;i++){float d=length(q-p[i]*A);float w=exp(-d*d*5.5);col+=c[i]*w;ws+=w;}
  col/=ws+.12;
  col+=.07*exp(-length(uv*A-m*A)*3.)+.12*env;
  col*=1.-.4*smoothstep(.4,1.,uv.y);
  col+=(h(gl_FragCoord.xy+fract(t))-.5)*.05;
  gl_FragColor=vec4(col,1.);
}`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
    if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, "a"); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      const U = (n) => gl.getUniformLocation(prog, n), uR = U("r"), uM = U("m"), uT = U("t"), uP = U("p[0]"), uC = U("c[0]"), uRP = U("rp");
      draw = (t) => {
        const scale = Math.min(devicePixelRatio || 1, 1.5) * .6;
        const w = Math.round(canvas.clientWidth * scale), h = Math.round(canvas.clientHeight * scale);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
        gl.uniform2f(uR, w, h); gl.uniform2f(uM, mouse.x, mouse.y); gl.uniform1f(uT, (t / 1000) % 600); gl.uniform3f(uRP, rip.x, rip.y, rip.t0);
        gl.uniform2fv(uP, new Float32Array(spots.flatMap((s) => [s.cx, s.cy])));
        gl.uniform3fv(uC, new Float32Array(spots.flatMap((s) => s.col)));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
    }
  }
  if (!draw) stage.classList.add("nogl");

  // Main loop: runs while the hero is visible; in reduced-motion mode it only redraws on input.
  const frame = (t) => {
    const w = stage.clientWidth, h = stage.clientHeight, k = reduce ? 1 : .07;
    mouse.x += (mouse.tx - mouse.x) * k; mouse.y += (mouse.ty - mouse.y) * k;
    spots.forEach((s) => {
      const dx = reduce ? 0 : Math.sin(t * .0004 + s.i * 2.1) * .035, dy = reduce ? 0 : Math.cos(t * .00035 + s.i * 1.7) * .035;
      s.cx += (s.tx + dx - s.cx) * k; s.cy += (s.ty + dy - s.cy) * k;
      s.col = s.col.map((v, j) => v + (s.tcol[j] - v) * (reduce ? 1 : .05));
      s.el.style.transform = `translate(${(s.cx * w).toFixed(1)}px,${(s.cy * h).toFixed(1)}px)`;
      s.el.classList.toggle("flip", s.cx > .62);
    });
    if (!reduce && fine) {
      const hr = copy.getBoundingClientRect(), px = mouse.cx - hr.left, py = mouse.cy - hr.top;
      letters.forEach((L) => {
        const cx = L.el.offsetLeft + L.el.offsetWidth / 2, cy = L.el.offsetTop + L.el.offsetHeight / 2, d = Math.hypot(px - cx, py - cy);
        const f = mouse.in ? Math.exp(-((d / 200) ** 2)) : 0;
        L.x += ((px - cx) * f * .16 - L.x) * .12; L.y += ((py - cy) * f * .16 - L.y) * .12;
        L.r += ((px - cx) / 40 * f - L.r) * .12; L.s += (1 + f * .1 - L.s) * .12;
        L.el.style.transform = `translate(${L.x.toFixed(1)}px,${L.y.toFixed(1)}px) rotate(${L.r.toFixed(2)}deg) scale(${L.s.toFixed(3)})`;
      });
    }
    draw && draw(t);
    running = false;
    if (!reduce && visible) wake();
  };
  function wake() { if (ready && !running) { running = true; requestAnimationFrame(frame); } }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(stage);
  addEventListener("resize", wake);
  ready = true;
  wake();

  // Frosted-glass cursor blob: trails the pointer, stretches with speed, wraps links and buttons.
  if (fine && !reduce) {
    const blob = document.createElement("div");
    blob.className = "blob"; blob.setAttribute("aria-hidden", "true"); document.body.append(blob);
    const B = { x: 0, y: 0, w: 38, h: 38, r: 19, px: 0, py: 0, tx: 0, ty: 0, el: null };
    addEventListener("pointermove", (e) => {
      if (!blob.classList.contains("on")) { B.x = e.clientX; B.y = e.clientY; }
      B.px = e.clientX; B.py = e.clientY; blob.classList.add("on");
      B.el = e.target.closest ? e.target.closest("a,button,.card") : null;
    });
    document.addEventListener("pointerleave", () => blob.classList.remove("on"));
    (function loop() {
      let tx = B.px, ty = B.py, tw = 38, th = 38, tr = 19, rot = 0, sx = 1, sy = 1;
      if (B.el) {
        const r = B.el.getBoundingClientRect(), big = B.el.matches(".card");
        if (big) { tw = th = 96; tr = 48; }
        else { tx = r.left + r.width / 2 + (B.px - r.left - r.width / 2) * .15; ty = r.top + r.height / 2 + (B.py - r.top - r.height / 2) * .2; tw = r.width + 14; th = r.height + 10; tr = Math.min(th / 2, (parseFloat(getComputedStyle(B.el).borderTopLeftRadius) || 10) + 5); }
      }
      const vx = tx - B.x, vy = ty - B.y;
      B.x += vx * .18; B.y += vy * .18; B.w += (tw - B.w) * .2; B.h += (th - B.h) * .2; B.r += (tr - B.r) * .2;
      if (!B.el) { const sp = Math.min(Math.hypot(vx, vy) * .02, .5); rot = Math.atan2(vy, vx); sx = 1 + sp; sy = 1 / Math.sqrt(sx); }
      blob.style.cssText = `width:${B.w.toFixed(1)}px;height:${B.h.toFixed(1)}px;border-radius:${B.r.toFixed(1)}px;transform:translate(${(B.x - B.w / 2).toFixed(1)}px,${(B.y - B.h / 2).toFixed(1)}px) rotate(${rot}rad) scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
      requestAnimationFrame(loop);
    })();
  }

  // Cursor spotlight on glass panels and magnetic buttons.
  document.querySelectorAll(".glass").forEach((el) => el.addEventListener("pointermove", (e) => {
    const r = el.getBoundingClientRect(); el.style.setProperty("--mx", `${e.clientX - r.left}px`); el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }));
  if (!reduce) document.querySelectorAll(".btn").forEach((b) => {
    b.addEventListener("pointermove", (e) => { const r = b.getBoundingClientRect(); b.style.translate = `${(e.clientX - r.left - r.width / 2) * .25}px ${(e.clientY - r.top - r.height / 2) * .35}px`; });
    b.addEventListener("pointerleave", () => { b.style.translate = ""; });
    b.style.transition = "translate .4s cubic-bezier(.2,.8,.2,1), background .3s";
  });
})();
