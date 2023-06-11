import { DensityLayer } from './DensityLayer';

export const BYTES_PER_FLOAT = 4;

export const FLOATS_PER_POSITION = 2;
export const FLOATS_PER_VALUE = 1;
export const FLOATS_PER_VERTEX = FLOATS_PER_POSITION + FLOATS_PER_VALUE;

export class Plotter {
    private canvasElement: HTMLCanvasElement;
    private gl: WebGL2RenderingContext;

    densityLayer: DensityLayer;

    constructor(canvasElement: HTMLCanvasElement) {
        const gl = canvasElement.getContext('webgl2', {
            alpha: true,
            premultipliedAlpha: false,
        });
        if (!gl) {
            throw new Error('Could not get WebGL2RenderingContext');
        }
        this.canvasElement = canvasElement;
        this.gl = gl;

        this.densityLayer = new DensityLayer(gl);
    }

    draw() {
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

        this.gl.clearColor(0, 0, 0, 1);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.densityLayer.draw();
    }

    private scheduledDrawHandle: number | null = null;

    scheduleDraw() {
        if (this.scheduledDrawHandle === null) {
            this.scheduledDrawHandle = window.requestAnimationFrame(() => {
                this.scheduledDrawHandle = null;
                this.draw();
            });
        }
    }
}
