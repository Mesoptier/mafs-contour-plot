import { Interval, vec } from 'mafs';

import { initShaderProgram } from '../util/webgl';
import {
    BYTES_PER_FLOAT,
    FLOATS_PER_POSITION,
    FLOATS_PER_VALUE,
    FLOATS_PER_VERTEX,
} from './Plotter';

export class DensityLayer {
    static FRAGMENT_SHADER = `#version 300 es
        precision highp float;
        
        in float v_gradient_coord;
        
        out vec4 out_color;
        
        uniform sampler2D u_gradient;
        
        void main() {
            out_color = texture(u_gradient, vec2(v_gradient_coord, 0.5));
        }
    `;
    static VERTEX_SHADER = `#version 300 es
        in vec4 a_position;
        in float a_value;
        
        out float v_gradient_coord;
        
        uniform vec2 u_value_range;
        uniform mat4 u_transform;
        
        void main() {
            float min_value = u_value_range.x;
            float max_value = u_value_range.y;
            v_gradient_coord = (a_value - min_value) / (max_value - min_value);
            gl_Position = a_position * u_transform;
        }
    `;

    private programInfo: {
        program: WebGLProgram;
        attribLocations: { position: number; value: number };
        uniformLocations: {
            transform: WebGLUniformLocation;
            valueRange: WebGLUniformLocation;
            gradient: WebGLUniformLocation;
        };
    };
    private vertexBuffer: WebGLBuffer;
    private indexBuffer: WebGLBuffer;
    private vao: WebGLVertexArrayObject;
    private gradientTexture: WebGLTexture;

    private elementCount = 0;

    constructor(private gl: WebGL2RenderingContext) {
        const shaderProgram = initShaderProgram(
            gl,
            DensityLayer.VERTEX_SHADER,
            DensityLayer.FRAGMENT_SHADER,
        );

        this.programInfo = {
            program: shaderProgram,
            attribLocations: {
                // vec4 (really just vec2)
                position: gl.getAttribLocation(shaderProgram, 'a_position'),
                // float
                value: gl.getAttribLocation(shaderProgram, 'a_value'),
            },
            uniformLocations: {
                // vec2
                valueRange: gl.getUniformLocation(
                    shaderProgram,
                    'u_value_range',
                )!,
                // mat4
                transform: gl.getUniformLocation(shaderProgram, 'u_transform')!,
                // sampler2D
                gradient: gl.getUniformLocation(shaderProgram, 'u_gradient')!,
            },
        };

        this.vertexBuffer = gl.createBuffer()!;
        this.indexBuffer = gl.createBuffer()!;
        if (!this.vertexBuffer || !this.indexBuffer) {
            throw new Error('Could not create buffers');
        }

        this.vao = gl.createVertexArray()!;
        if (!this.vao) {
            throw new Error('Could not create vertex array object');
        }

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);

        gl.enableVertexAttribArray(this.programInfo.attribLocations.position);
        gl.vertexAttribPointer(
            this.programInfo.attribLocations.position,
            FLOATS_PER_POSITION,
            gl.FLOAT,
            false,
            FLOATS_PER_VERTEX * BYTES_PER_FLOAT,
            0,
        );

        gl.enableVertexAttribArray(this.programInfo.attribLocations.value);
        gl.vertexAttribPointer(
            this.programInfo.attribLocations.value,
            FLOATS_PER_VALUE,
            gl.FLOAT,
            false,
            FLOATS_PER_VERTEX * BYTES_PER_FLOAT,
            FLOATS_PER_POSITION * BYTES_PER_FLOAT,
        );

        gl.bindVertexArray(null);

        this.gradientTexture = gl.createTexture()!;
        if (!this.gradientTexture) {
            throw new Error('Could not create texture');
        }
    }

    updateValueRange(valueRange: Interval): void {
        this.gl.useProgram(this.programInfo.program);
        this.gl.uniform2f(
            this.programInfo.uniformLocations.valueRange,
            valueRange[0],
            valueRange[1],
        );
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

    updateGradient(gradient: ImageData, smooth = true): void {
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.gradientTexture);
        this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_MIN_FILTER,
            smooth ? this.gl.LINEAR : this.gl.NEAREST,
        );
        this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_MAG_FILTER,
            smooth ? this.gl.LINEAR : this.gl.NEAREST,
        );
        this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_WRAP_S,
            this.gl.CLAMP_TO_EDGE,
        );
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            this.gl.RGBA,
            gradient.width,
            gradient.height,
            0,
            this.gl.RGBA,
            this.gl.UNSIGNED_BYTE,
            gradient.data,
        );
    }

    updateMesh(vertexData: Float32Array, indexData: Uint32Array): void {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
        this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            vertexData,
            this.gl.STATIC_DRAW,
        );

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        this.gl.bufferData(
            this.gl.ELEMENT_ARRAY_BUFFER,
            indexData,
            this.gl.STATIC_DRAW,
        );

        this.elementCount = indexData.length;
    }

    draw(): void {
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.gradientTexture);
        this.gl.uniform1i(this.programInfo.uniformLocations.gradient, 0);

        this.gl.bindVertexArray(this.vao);
        this.gl.drawElements(
            this.gl.TRIANGLES,
            this.elementCount,
            this.gl.UNSIGNED_INT,
            0,
        );
    }
}
