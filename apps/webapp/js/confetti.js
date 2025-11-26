// webapp/js/confetti.js

let confettiPieces = [];
let confettiRunning = false;
let animationFrameId = null;

export function startConfetti() {
    if (confettiRunning) return; // evitar duplicado
    confettiRunning = true;

    const canvas = document.getElementById("confettiCanvas");
    const ctx = canvas.getContext("2d");

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const colors = ["#fbbf24", "#818cf8", "#4f46e5", "#22d3ee", "#ffffff"];
    confettiPieces = [];

    for (let i = 0; i < 200; i++) {
        confettiPieces.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            size: Math.random() * 6 + 4,
            speed: Math.random() * 3 + 1,
            color: colors[(Math.random() * colors.length) | 0],
            tilt: Math.random() * 20 - 10,
            tiltAngle: Math.random() * Math.PI,
            tiltAngleSpeed: 0.1 + Math.random() * 0.1
        });
    }

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function update() {
        confettiPieces.forEach((p) => {
            p.y += p.speed;
            p.tiltAngle += p.tiltAngleSpeed;
            p.tilt = Math.sin(p.tiltAngle) * 15;

            if (p.y > canvas.height) {
                p.y = -20;
                p.x = Math.random() * canvas.width;
            }
        });
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        confettiPieces.forEach((p) => {
            ctx.beginPath();
            ctx.fillStyle = p.color;
            ctx.ellipse(p.x + p.tilt, p.y, p.size, p.size * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    function loop() {
        if (!confettiRunning) return;
        update();
        draw();
        animationFrameId = requestAnimationFrame(loop);
    }

    loop();
}

export function stopConfetti() {
    confettiRunning = false;

    const canvas = document.getElementById("confettiCanvas");
    const ctx = canvas.getContext("2d");

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
