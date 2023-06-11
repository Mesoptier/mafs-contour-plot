import { vec } from 'mafs';

type Vertex = [x: number, y: number, value: number];

type TriangleElements = [
    vertexIdx1: number,
    vertexIdx2: number,
    vertexIdx3: number,
];
type TriangleVertices = [vertex1: Vertex, vertex2: Vertex, vertex3: Vertex];
type TriangleEdge = [triangleIndex: number, edgeIndex: number];

type Triangle = {
    elements: TriangleElements;
    connectivity: [
        edge1: TriangleEdge | null,
        edge2: TriangleEdge | null,
        edge3: TriangleEdge | null,
    ];
    degree: number;
};

function triangleConnectionToNumber(c: TriangleEdge | null): number {
    if (c === null) {
        return -1;
    }
    const [triangleIdx, edgeIdx] = c;
    return triangleIdx * 3 + edgeIdx;
}

function numberToTriangleConnection(n: number): TriangleEdge | null {
    if (n === -1) {
        return null;
    }
    const triangleIdx = Math.trunc(n / 3);
    const edgeIdx = n % 3;
    return [triangleIdx, edgeIdx];
}

interface RefineOptions {
    shouldRefineTriangle: (triangleVertices: TriangleVertices) => boolean;
    minDegree?: number;
    maxDegree?: number;
}

export class Mesh {
    private vertices: number[] = [];
    private triangleElements: number[] = [];
    private triangleConnections: number[] = [];
    private triangleDegrees: number[] = [];

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
                this.pushVertex([x, y, f([x, y])]);
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

                this.pushTriangle(
                    makeTriangle([blIdx, trIdx, brIdx], quadIdx * 2),
                );
                this.pushTriangle(
                    makeTriangle([trIdx, blIdx, tlIdx], quadIdx * 2 + 1),
                );
            }
        }
    }

    public refine(
        f: (xy: vec.Vector2) => number,
        options: RefineOptions,
    ): void {
        const { shouldRefineTriangle, minDegree = 1, maxDegree = 10 } = options;

        type Entry = { triangleIdx: number; triangleDegree: number };
        const queue: Entry[] = Array.from({
            length: this.triangleDegrees.length,
        }).map((_, triangleIdx) => ({ triangleIdx, triangleDegree: 0 }));

        while (queue.length > 0) {
            const entry = queue.shift()!;
            if (entry.triangleDegree > maxDegree) {
                continue;
            }
            if (
                this.getTriangleDegree(entry.triangleIdx) !==
                entry.triangleDegree
            ) {
                continue;
            }
            if (
                entry.triangleDegree >= minDegree &&
                !shouldRefineTriangle(
                    this.getTriangleVertices(entry.triangleIdx),
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
                    triangleDegree: this.getTriangleDegree(triangleIdx),
                });
            });
        }
    }

    private refineTriangleBase(
        triangleIdx: number,
        f: (xy: vec.Vector2) => number,
        updatedTriangleIndices: number[],
    ): [number, number] {
        const triangleVertices = this.getTriangleVertices(triangleIdx);
        const edge = [triangleVertices[0], triangleVertices[1]];
        const midPoint = vec.midpoint(
            [edge[0][0], edge[0][1]],
            [edge[1][0], edge[1][1]],
        );
        const midValue = f(midPoint);

        let otherTriangleIdx: number | null = null;
        const triangleConnection = this.getTriangleConnection(triangleIdx, 0);
        if (triangleConnection) {
            const [adjacentTriangleIdx, adjacentEdgeIdx] = triangleConnection;
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

        const newVertexIdx = this.pushVertex([
            midPoint[0],
            midPoint[1],
            midValue,
        ]);

        const [edge1, edge2] = this.subdivideTriangleBase(
            triangleIdx,
            newVertexIdx,
        );

        updatedTriangleIndices.push(edge1[0]);
        updatedTriangleIndices.push(edge2[0]);

        if (otherTriangleIdx !== null) {
            const [otherEdge1, otherEdge2] = this.subdivideTriangleBase(
                otherTriangleIdx,
                newVertexIdx,
            );

            updatedTriangleIndices.push(otherEdge1[0]);
            updatedTriangleIndices.push(otherEdge2[0]);

            const connectEdges = (e1: TriangleEdge, e2: TriangleEdge) => {
                this.setTriangleConnection(e1[0], e1[1], e2);
                this.setTriangleConnection(e2[0], e2[1], e1);
            };
            connectEdges(edge1, otherEdge2);
            connectEdges(edge2, otherEdge1);
        }

        return [edge1[0], edge2[0]];
    }

    private subdivideTriangleBase(
        triangleIdx: number,
        newVertexIdx: number,
    ): [TriangleEdge, TriangleEdge] {
        //       2                    2
        //      ╱ ╲                  ╱|╲
        //    ╱     ╲      ->      ╱  |  ╲
        //  ╱    T    ╲          ╱  T | T' ╲
        // 1 --------- 0        1 --- m --- 0

        const triangleElements = this.getTriangleElements(triangleIdx);
        const triangleDegree = this.getTriangleDegree(triangleIdx);

        const newTriangleIdx = this.pushTriangle({
            elements: [triangleElements[2], triangleElements[0], newVertexIdx],
            connectivity: [
                this.getTriangleConnection(triangleIdx, 2),
                null, // Connected later
                [triangleIdx, 1],
            ],
            degree: triangleDegree + 1,
        });

        this.setTriangle(triangleIdx, {
            elements: [triangleElements[1], triangleElements[2], newVertexIdx],
            connectivity: [
                this.getTriangleConnection(triangleIdx, 1),
                [newTriangleIdx, 2],
                null, // Connected later
            ],
            degree: triangleDegree + 1,
        });

        // Fix connectivity
        [triangleIdx, newTriangleIdx].forEach((triangleIdx) => {
            const connection = this.getTriangleConnection(triangleIdx, 0);
            if (connection !== null) {
                const [otherTriangleIdx, otherEdgeIdx] = connection;
                this.setTriangleConnection(otherTriangleIdx, otherEdgeIdx, [
                    triangleIdx,
                    0,
                ]);
            }
        });

        return [
            [triangleIdx, 2],
            [newTriangleIdx, 1],
        ];
    }

    public getVertex(vertexIdx: number): Vertex {
        return this.vertices.slice(
            vertexIdx * 3,
            (vertexIdx + 1) * 3,
        ) as Vertex;
    }

    public pushVertex(vertex: Vertex): number {
        const vertexIdx = this.vertices.length / 3;
        this.vertices.push(vertex[0], vertex[1], vertex[2]);
        return vertexIdx;
    }

    public getTriangleElements(triangleIdx: number): TriangleElements {
        return [
            this.triangleElements[triangleIdx * 3],
            this.triangleElements[triangleIdx * 3 + 1],
            this.triangleElements[triangleIdx * 3 + 2],
        ];
    }

    public getTriangleVertices(triangleIdx: number): TriangleVertices {
        const [vertexIdx1, vertexIdx2, vertexIdx3] =
            this.getTriangleElements(triangleIdx);
        return [
            this.getVertex(vertexIdx1),
            this.getVertex(vertexIdx2),
            this.getVertex(vertexIdx3),
        ];
    }

    public getTriangleConnection(
        triangleIdx: number,
        edgeIdx: number,
    ): TriangleEdge | null {
        return numberToTriangleConnection(
            this.triangleConnections[triangleIdx * 3 + edgeIdx],
        );
    }

    public setTriangleConnection(
        triangleIdx: number,
        edgeIdx: number,
        connection: TriangleEdge | null,
    ): void {
        this.triangleConnections[triangleIdx * 3 + edgeIdx] =
            triangleConnectionToNumber(connection);
    }

    public getTriangleDegree(triangleIdx: number): number {
        return this.triangleDegrees[triangleIdx];
    }

    public setTriangle(triangleIdx: number, triangle: Triangle): void {
        this.triangleElements[triangleIdx * 3] = triangle.elements[0];
        this.triangleElements[triangleIdx * 3 + 1] = triangle.elements[1];
        this.triangleElements[triangleIdx * 3 + 2] = triangle.elements[2];

        this.setTriangleConnection(triangleIdx, 0, triangle.connectivity[0]);
        this.setTriangleConnection(triangleIdx, 1, triangle.connectivity[1]);
        this.setTriangleConnection(triangleIdx, 2, triangle.connectivity[2]);

        this.triangleDegrees[triangleIdx] = triangle.degree;
    }

    public pushTriangle(triangle: Triangle): number {
        const triangleIdx = this.triangleDegrees.length;
        this.triangleElements.push(
            triangle.elements[0],
            triangle.elements[1],
            triangle.elements[2],
        );
        this.triangleConnections.push(
            triangleConnectionToNumber(triangle.connectivity[0]),
            triangleConnectionToNumber(triangle.connectivity[1]),
            triangleConnectionToNumber(triangle.connectivity[2]),
        );
        this.triangleDegrees.push(triangle.degree);
        return triangleIdx;
    }

    public getVertexData(): Float32Array {
        return new Float32Array(this.vertices);
    }

    public getIndexData(): Uint32Array {
        return new Uint32Array(this.triangleElements);
    }
}
