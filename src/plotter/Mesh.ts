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
                const brXIdx = Math.floor(brIdx / yCoords.length);
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
                const tlXIdx = Math.floor(tlIdx / yCoords.length);
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

    public refine(
        f: (xy: vec.Vector2) => number,
        shouldRefineTriangle: (
            triangleVertices: [Vertex, Vertex, Vertex],
        ) => boolean,
    ): void {
        type Entry = { triangleIdx: number; triangleDegree: number };
        const queue: Entry[] = Array.from({
            length: this.triangles.length,
        }).map((_, triangleIdx) => ({ triangleIdx, triangleDegree: 0 }));

        // TODO: Add options for min/max degree
        const minDegree = 1;
        const maxDegree = 10;

        while (queue.length > 0) {
            const entry = queue.shift()!;
            if (entry.triangleDegree > maxDegree) {
                continue;
            }
            if (
                this.triangles[entry.triangleIdx].degree !==
                entry.triangleDegree
            ) {
                continue;
            }
            if (
                entry.triangleDegree >= minDegree &&
                !shouldRefineTriangle(
                    this.triangles[entry.triangleIdx].elements.map(
                        (vertexIdx) => this.vertices[vertexIdx],
                    ) as [Vertex, Vertex, Vertex],
                )
            ) {
                continue;
            }

            const updatedTriangleIndices: number[] = [];
            this.refineTriangleBase(
                entry.triangleIdx,
                f,
                updatedTriangleIndices,
            );
            updatedTriangleIndices.forEach((triangleIdx) => {
                queue.push({
                    triangleIdx,
                    triangleDegree: this.triangles[triangleIdx].degree,
                });
            });
        }
    }

    private refineTriangleBase(
        triangleIdx: number,
        f: (xy: vec.Vector2) => number,
        updatedTriangleIndices: number[],
    ): [number, number] {
        const triangle = this.triangles[triangleIdx];

        const edge = [
            this.vertices[triangle.elements[0]],
            this.vertices[triangle.elements[1]],
        ];
        const midPoint = vec.midpoint(
            [edge[0][0], edge[0][1]],
            [edge[1][0], edge[1][1]],
        );
        const midValue = f(midPoint);

        let otherTriangleIdx: number | null = null;
        if (triangle.connectivity[0]) {
            const [adjacentTriangleIdx, adjacentEdgeIdx] =
                triangle.connectivity[0];
            if (adjacentEdgeIdx === 0) {
                otherTriangleIdx = adjacentTriangleIdx;
            } else {
                // Subdivide the connected triangle and return the index of the
                // new triangle that's now connected at the base
                otherTriangleIdx = this.refineTriangleBase(
                    adjacentTriangleIdx,
                    f,
                    updatedTriangleIndices,
                )[adjacentEdgeIdx - 1];
            }
        }

        console.assert(
            otherTriangleIdx === null ||
                this.triangles[otherTriangleIdx].degree === triangle.degree,
        );

        const newVertexIdx = this.vertices.length;
        this.vertices.push([midPoint[0], midPoint[1], midValue]);

        const foo = (
            triangleIdx: number,
        ): [TriangleConnection, TriangleConnection] => {
            //       2                    2
            //      ╱ ╲                  ╱|╲
            //    ╱     ╲      ->      ╱  |  ╲
            //  ╱    T    ╲          ╱  T | T' ╲
            // 1 --------- 0        1 --- m --- 0

            const triangle = this.triangles[triangleIdx];
            const newTriangleIdx = this.triangles.length;

            this.triangles[triangleIdx] = {
                elements: [
                    triangle.elements[1],
                    triangle.elements[2],
                    newVertexIdx,
                ],
                connectivity: [
                    triangle.connectivity[1],
                    [newTriangleIdx, 2],
                    null, // Connected later
                ],
                degree: triangle.degree + 1,
            };

            this.triangles.push({
                elements: [
                    triangle.elements[2],
                    triangle.elements[0],
                    newVertexIdx,
                ],
                connectivity: [
                    triangle.connectivity[2],
                    null, // Connected later
                    [triangleIdx, 1],
                ],
                degree: triangle.degree + 1,
            });

            // Fix connectivity
            [triangleIdx, newTriangleIdx].forEach((triangleIdx) => {
                const connection = this.triangles[triangleIdx].connectivity[0];
                if (connection !== null) {
                    const [otherTriangleIdx, otherEdgeIdx] = connection;
                    this.triangles[otherTriangleIdx].connectivity[
                        otherEdgeIdx
                    ] = [triangleIdx, 0];
                }
            });

            updatedTriangleIndices.push(triangleIdx);
            updatedTriangleIndices.push(newTriangleIdx);

            return [
                [triangleIdx, 2],
                [newTriangleIdx, 1],
            ];
        };

        const [edge1, edge2] = foo(triangleIdx);

        if (otherTriangleIdx !== null) {
            const [otherEdge1, otherEdge2] = foo(otherTriangleIdx);
            const connectEdges = (
                e1: TriangleConnection,
                e2: TriangleConnection,
            ) => {
                this.triangles[e1[0]].connectivity[e1[1]] = e2;
                this.triangles[e2[0]].connectivity[e2[1]] = e1;
            };
            connectEdges(edge1, otherEdge2);
            connectEdges(edge2, otherEdge1);
        }

        return [edge1[0], edge2[0]];
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
