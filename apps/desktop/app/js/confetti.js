export function startConfetti() {
    const canvas = document.getElementById("confettiCanvas");
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confetti = [];
    const colors = ["#fbbf24", "#818cf8", "#4f46e5", "#22d3ee", "#ffffff"];

    for (let i = 0; i < 180; i++) {
        confetti.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            r: Math.random() * 6 + 4,
            d: Math.random() * 80 + 20,
            color: colors[Math.floor(Math.random() * colors.length)],
            tilt: Math.random() * 10 - 10,
            tiltAngle: 0
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        confetti.forEach((c) => {
            ctx.beginPath();
            ctx.fillStyle = c.color;
            ctx.ellipse(c.x, c.y, c.r, c.r * 0.6, c.tilt, 0, Math.PI * 2);
            ctx.fill();
        });

        update();
    }

    function update() {
        confetti.forEach((c) => {
            c.y += Math.cos(c.d) + 2;
            c.x += Math.sin(c.d);

            c.tiltAngle += 0.1;
            c.tilt = Math.sin(c.tiltAngle) * 10;

            if (c.y > canvas.height) {
                c.y = -20;
                c.x = Math.random() * canvas.width;
            }
        });
    }

    function loop() {
        requestAnimationFrame(loop);
        draw();
    }

    loop();
}

export function stopConfetti() {
    const canvas = document.getElementById("confettiCanvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
