export class VideoSource {
    readonly video: HTMLVideoElement;
    readonly texture: GPUTexture;
    readonly sampler: GPUSampler;

    width: number;
    height: number;

    private hasFrame = false;

    constructor(
        device: GPUDevice,
        width: number,
        height: number,
        src: string
    ) {
        this.width = width;
        this.height = height;

        this.video = document.createElement("video");
        this.video.src = src;
        this.video.crossOrigin = "anonymous";
        this.video.muted = true;
        this.video.loop = true;
        this.video.autoplay = false;
        this.video.playsInline = true;

        this.video.onloadedmetadata = () => {
            console.log(
                "VIDEO METADATA:",
                this.video.videoWidth,
                this.video.videoHeight
            );
        };

        this.video.onplaying = () => {
            console.log("VIDEO PLAYING — frames available");
        };

        const onVideoFrame = () => {
            this.hasFrame = true;
            this.video.requestVideoFrameCallback(onVideoFrame);
        };

        this.video.requestVideoFrameCallback(onVideoFrame);

        this.texture = device.createTexture({
            size: [this.width, this.height],
            format: "rgba8unorm",
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT
        });

        this.sampler = device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
        });
    }

    update(device: GPUDevice) {
        if (!this.hasFrame) return;

        const vw = this.video.videoWidth;
        const vh = this.video.videoHeight;

        if (vw === 0 || vh === 0) return;

        device.queue.copyExternalImageToTexture(
            { source: this.video },
            { texture: this.texture },
            [vw, vh]
        );

        this.hasFrame = false;
    }
}
