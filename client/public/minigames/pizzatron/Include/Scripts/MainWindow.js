// Scale do game-box so quando a janela muda de tamanho — antes rodava a
// 30fps forcando layout a cada tick sem necessidade (o clientWidth do
// iframe so muda em resize).
function fitGameBox() {
	var g = $(".game-box")[0];
	if (!g) return;
	var s = 1 / Math.min(g.clientWidth / innerWidth, g.clientHeight / innerHeight);
	var t = "scale(" + s + ")";
	if (g._fitT !== t) { g._fitT = t; g.style.transform = t; }
}
window.addEventListener("resize", fitGameBox);
fitGameBox();
