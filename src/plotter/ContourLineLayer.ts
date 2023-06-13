import { initShaderProgram } from '../util/webgl';
import {
    BYTES_PER_FLOAT,
    FLOATS_PER_POSITION,
    FLOATS_PER_VALUE,
    FLOATS_PER_VERTEX,
} from './Plotter';
import { vec } from 'mafs';

export class ContourLineLayer {
    static FRAGMENT_SHADER = `#version 300 es
        precision highp float;

        in vec4 v_color;
        out vec4 out_color;
        
        void main() {
            out_color = v_color;
        }
    `;
    static VERTEX_SHADER = `#version 300 es
        in vec4 a_position;
        out vec4 v_color;
        
        uniform mat4 u_transform;
        
        void main() {
            v_color = vec4(1.0, 1.0, 1.0, 1.0);
            gl_Position = a_position * u_transform;
        }
    `;
    private programInfo: {
        program: WebGLProgram;
        attribLocations: { position: number };
        uniformLocations: { transform: WebGLUniformLocation };
    };
    private vertexBuffer: WebGLBuffer;
    private vao: WebGLVertexArrayObject;
    private elementCount = 0;

    constructor(private gl: WebGL2RenderingContext) {
        const shaderProgram = initShaderProgram(
            gl,
            ContourLineLayer.VERTEX_SHADER,
            ContourLineLayer.FRAGMENT_SHADER,
        );

        this.programInfo = {
            program: shaderProgram,
            attribLocations: {
                // vec4 (really just vec2)
                position: gl.getAttribLocation(shaderProgram, 'a_position'),
            },
            uniformLocations: {
                // mat4
                transform: gl.getUniformLocation(shaderProgram, 'u_transform')!,
            },
        };

        this.vertexBuffer = gl.createBuffer()!;
        if (!this.vertexBuffer) {
            throw new Error('Could not create buffers');
        }

        this.vao = gl.createVertexArray()!;
        if (!this.vao) {
            throw new Error('Could not create vertex array object');
        }

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

        gl.enableVertexAttribArray(this.programInfo.attribLocations.position);
        gl.vertexAttribPointer(
            this.programInfo.attribLocations.position,
            FLOATS_PER_POSITION,
            gl.FLOAT,
            false,
            FLOATS_PER_POSITION * BYTES_PER_FLOAT,
            0,
        );
        gl.bindVertexArray(null);
    }

    updateTransform(mat: vec.Matrix): void {
        const [a, c, tx, b, d, ty] = mat;
        this.gl.useProgram(this.programInfo.program);
        this.gl.uniformMatrix4fv(
            this.programInfo.uniformLocations.transform,
            true,
            [a, b, 0, 0, c, d, 0, 0, 0, 0, 1, 0, tx, ty, 0, 1],
        );
    }

    updateBuffer(vertexData: Float32Array): void {
        this.gl.useProgram(this.programInfo.program);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            vertexData,
            this.gl.STATIC_DRAW,
        );

        this.elementCount = vertexData.length / 2;
    }

    draw(): void {
        this.gl.useProgram(this.programInfo.program);
        this.gl.bindVertexArray(this.vao);
        this.gl.drawArrays(this.gl.LINES, 0, this.elementCount);
    }
}
