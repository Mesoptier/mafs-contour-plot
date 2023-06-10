import { vec } from 'mafs';

type Vertex = [x: number, y: number, value: number];

type TriangleConnection = [triangleIndex: number, edgeIndex: number];

type Triangle = {
    elements: [index1: number, index2: number, index3: number];
    connectivity: [
        side1: TriangleConnection | null,
        side2: TriangleConnection | null,
        side3: TriangleConnection | null,
    ];
    degree: number;
};

export class Mesh {
    private vertices: Vertex[] = [];
    private triangles: Triangle[] = [];

    constructor(
        xCoords: number[],
        yCoords: number[],
        f: (xy: vec.Vector2) => number,
    ) {
        // Build vertices
        for (let xIdx = 0; xIdx < xCoords.length; ++xIdx) {
            for (let yIdx = 0; yIdx < yCoords.length; ++yIdx) {
                const x = xCoords[xIdx];
                const y = yCoords[yIdx];
                this.vertices.push([x, y, f([x, y])] as Vertex);
            }
        }

        // Offsets to next triangle idx
        const offsetX = 2 * (yCoords.length - 1) + 1;
        const offsetY = 1;

        const computeConnectivity = (
            elements: [index1: number, index2: number, index3: number],
            triangleIdx: number,
        ): Triangle['connectivity'] => {
            if (triangleIdx % 2 === 0) {
                const brIdx = elements[2];
                const brXIdx = brIdx / yCoords.length;
                const brYIdx = brIdx % yCoords.length;

                return [
                    [triangleIdx + 1, 0],
                    brXIdx + 1 < xCoords.length
                        ? [triangleIdx + offsetX, 1]
                        : null,
                    brYIdx > 0 ? [triangleIdx - offsetY, 2] : null,
                ];
            } else {
                const tlIdx = elements[2];
                const tlXIdx = tlIdx / yCoords.length;
                const tlYIdx = tlIdx % yCoords.length;

                return [
                    [triangleIdx - 1, 0],
                    tlXIdx > 0 ? [triangleIdx - offsetX, 1] : null,
                    tlYIdx + 1 < yCoords.length
                        ? [triangleIdx + offsetY, 2]
                        : null,
                ];
            }
        };

        const makeTriangle = (
            elements: [index1: number, index2: number, index3: number],
            triangleIdx: number,
        ): Triangle => ({
            elements,
            connectivity: computeConnectivity(elements, triangleIdx),
            degree: 0,
        });

        // Build triangles
        for (let xIdx = 0, quadIdx = 0; xIdx + 1 < xCoords.length; ++xIdx) {
            for (let yIdx = 0; yIdx + 1 < yCoords.length; ++yIdx, ++quadIdx) {
                const blIdx = yIdx + xIdx * yCoords.length;
                const tlIdx = blIdx + 1;
                const brIdx = blIdx + yCoords.length;
                const trIdx = brIdx + 1;

                this.triangles.push(
                    makeTriangle([blIdx, trIdx, brIdx], quadIdx * 2),
                );
                this.triangles.push(
                    makeTriangle([trIdx, blIdx, tlIdx], quadIdx * 2 + 1),
                );
            }
        }
    }

    public getVertexData(): Float32Array {
        return new Float32Array(this.vertices.flat());
    }

    public getIndexData(): Uint32Array {
        return new Uint32Array(
            this.triangles.flatMap((triangle) => triangle.elements),
        );
    }
}
