export class FrameLoop {
    private prevTime = 0;
    private rafId = 0;

    constructor(
        private update: (dt: number) => void,
        private render: () => void
    ) { }

    start() {
        const loop = (time: number) => {
            const dt = this.prevTime === 0 ? 0 : (time - this.prevTime) * 0.001;
            this.prevTime = time;

            this.update(dt);
            this.render();

            this.rafId = requestAnimationFrame(loop);
        };

        this.rafId = requestAnimationFrame(loop);
    }

    stop() {
        cancelAnimationFrame(this.rafId);
    }
}