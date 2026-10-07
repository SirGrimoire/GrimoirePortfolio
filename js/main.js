(() => {
  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const stage = $("#stage"), canvas = $("#gl"), clamp = (v) => Math.min(.98, Math.max(.02, v));
  $("#yr").textContent = new Date().getFullYear();

  // Split the name into letters for the entrance animation.
  const h1 = $("#name");
  h1.innerHTML = [...h1.textContent].map((c, i) => `<span class="ch" aria-hidden="true" style="--i:${i}">${c}</span>`).join("");

  // Colour spots: lerped toward targets, drawn as draggable rings and fed to the shader.
  const defs = [
    { n: "Ruri", h: "#4F7CAC", x: .80, y: .22 }, { n: "Tsutsuji", h: "#C77DA3", x: .58, y: .55 },
    { n: "Kaki", h: "#E8A87C", x: .88, y: .72 }, { n: "Kakitsubata", h: "#6C5B9E", x: .30, y: .28 },
  ];
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const mouse = { x: .5, y: .5, tx: .5, ty: .5 };
  const spots = defs.map((d, i) => {
    const el = document.createElement("div");
    el.className = "spot"; el.style.setProperty("--c", d.h);
    el.innerHTML = `<button class="ring" type="button" aria-label="Move ${d.n} colour. Drag or use arrow keys."></button><span class="chip"><i></i>${d.n} <small>${d.h.toUpperCase()}</small></span>`;
    stage.append(el);
    const s = { d, el, i, tx: d.x, ty: d.y, cx: d.x, cy: d.y, col: rgb(d.h) }, ring = el.firstChild;
    const move = (e) => { const r = stage.getBoundingClientRect(); s.tx = clamp((e.clientX - r.left) / r.width); s.ty = clamp((e.clientY - r.top) / r.height); wake(); };
    ring.addEventListener("pointerdown", (e) => { ring.setPointerCapture(e.pointerId); ring.classList.add("drag"); move(e); });
    ring.addEventListener("pointermove", (e) => ring.classList.contains("drag") && move(e));
    ["pointerup", "pointercancel"].forEach((ev) => ring.addEventListener(ev, () => ring.classList.remove("drag")));
    ring.addEventListener("keydown", (e) => {
      const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!k) return; e.preventDefault(); s.tx = clamp(s.tx + k[0] * .04); s.ty = clamp(s.ty + k[1] * .04); wake();
    });
    return s;
  });
  stage.addEventListener("pointermove", (e) => { const r = stage.getBoundingClientRect(); mouse.tx = (e.clientX - r.left) / r.width; mouse.ty = (e.clientY - r.top) / r.height; wake(); });

  // WebGL: domain-warped blend of the four colour spots, plus a soft pointer light and film grain.
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
uniform vec2 r,m,p[4];uniform vec3 c[4];uniform float t;
float h(vec2 x){return fract(sin(dot(x,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  float asp=r.x/r.y;vec2 uv=gl_FragCoord.xy/r;uv.y=1.-uv.y;vec2 q=uv*vec2(asp,1.);
  for(int i=0;i<3;i++){q+=.12*vec2(sin(q.y*3.+t*.5+float(i)*1.7),cos(q.x*3.+t*.4+float(i)*2.3));}
  vec3 col=vec3(0.);float ws=0.;
  for(int i=0;i<4;i++){float d=length(q-p[i]*vec2(asp,1.));float w=exp(-d*d*5.5);col+=c[i]*w;ws+=w;}
  col/=ws+.12;
  col+=.07*exp(-length(uv*vec2(asp,1.)-m*vec2(asp,1.))*3.);
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
      const U = (n) => gl.getUniformLocation(prog, n), uR = U("r"), uM = U("m"), uT = U("t"), uP = U("p[0]"), uC = U("c[0]");
      gl.uniform3fv(uC, new Float32Array(spots.flatMap((s) => s.col)));
      draw = (t) => {
        const scale = Math.min(devicePixelRatio || 1, 1.5) * .6; // smooth gradient: render small, let CSS scale it
        const w = Math.round(canvas.clientWidth * scale), h = Math.round(canvas.clientHeight * scale);
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
        gl.uniform2f(uR, w, h); gl.uniform2f(uM, mouse.x, mouse.y); gl.uniform1f(uT, (t / 1000) % 600);
        gl.uniform2fv(uP, new Float32Array(spots.flatMap((s) => [s.cx, s.cy])));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
    }
  }
  if (!draw) stage.classList.add("nogl");

  // Animation loop: runs while the hero is on screen; in reduced-motion mode it only redraws on input.
  let visible = true, running = false;
  const frame = (t) => {
    const w = stage.clientWidth, h = stage.clientHeight, k = reduce ? 1 : .07;
    mouse.x += (mouse.tx - mouse.x) * k; mouse.y += (mouse.ty - mouse.y) * k;
    spots.forEach((s) => {
      const dx = reduce ? 0 : Math.sin(t * .0004 + s.i * 2.1) * .035, dy = reduce ? 0 : Math.cos(t * .00035 + s.i * 1.7) * .035;
      s.cx += (s.tx + dx - s.cx) * k; s.cy += (s.ty + dy - s.cy) * k;
      s.el.style.transform = `translate(${(s.cx * w).toFixed(1)}px,${(s.cy * h).toFixed(1)}px)`;
      s.el.classList.toggle("flip", s.cx > .62);
    });
    draw && draw(t);
    running = false;
    if (!reduce && visible) wake();
  };
  function wake() { if (!running) { running = true; requestAnimationFrame(frame); } }
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(stage);
  addEventListener("resize", wake);
  wake();

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
