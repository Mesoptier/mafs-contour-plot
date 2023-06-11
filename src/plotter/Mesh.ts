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
            if (
                this.triangleDegrees[entry.triangleIdx] !== entry.triangleDegree
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
            for (const triangleIdx of updatedTriangleIndices) {
                const triangleDegree = this.triangleDegrees[triangleIdx];
                if (triangleDegree > maxDegree) {
                    continue;
                }
                queue.push({
                    triangleIdx,
                    triangleDegree,
                });
            }
        }
    }

    private refineTriangleBase(
        triangleIdx: number,
        f: (xy: vec.Vector2) => number,
        updatedTriangleIndices: number[],
    ): [number, number] {
        // Get the index of the triangle connected to the base of the current
        // triangle (if any)
        let otherTriangleIdx: number = -1;
        const triangleConnection = this.triangleConnections[triangleIdx * 3];
        if (triangleConnection !== -1) {
            const adjacentTriangleIdx = Math.trunc(triangleConnection / 3);
            const adjacentEdgeIdx = triangleConnection % 3;

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

        // Build and push the new vertex
        const triangleVertices = this.getTriangleVertices(triangleIdx);
        const edge = [triangleVertices[0], triangleVertices[1]];
        const midPoint = vec.midpoint(
            [edge[0][0], edge[0][1]],
            [edge[1][0], edge[1][1]],
        );
        const midValue = f(midPoint);

        const newVertexIdx = this.vertices.length / 3;
        this.vertices.push(midPoint[0], midPoint[1], midValue);

        // Subdivide the first triangle
        const [edge1, edge2] = this.subdivideTriangleBase(
            triangleIdx,
            newVertexIdx,
        );

        updatedTriangleIndices.push(edge1[0]);
        updatedTriangleIndices.push(edge2[0]);

        // If this triangle is connected at the base to another triangle, we'll
        // need to subdivide that one as well
        if (otherTriangleIdx !== -1) {
            const [otherEdge1, otherEdge2] = this.subdivideTriangleBase(
                otherTriangleIdx,
                newVertexIdx,
            );

            updatedTriangleIndices.push(otherEdge1[0]);
            updatedTriangleIndices.push(otherEdge2[0]);

            // Reconnect subdivided base edges of both triangles
            const edgeIdx1 = edge1[0] * 3 + edge1[1];
            const otherEdgeIdx2 = otherEdge2[0] * 3 + otherEdge2[1];
            this.triangleConnections[edgeIdx1] = otherEdgeIdx2;
            this.triangleConnections[otherEdgeIdx2] = edgeIdx1;

            const edgeIdx2 = edge2[0] * 3 + edge2[1];
            const otherEdgeIdx1 = otherEdge1[0] * 3 + otherEdge1[1];
            this.triangleConnections[edgeIdx2] = otherEdgeIdx1;
            this.triangleConnections[otherEdgeIdx1] = edgeIdx2;
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

        const triangleElements = [
            this.triangleElements[triangleIdx * 3],
            this.triangleElements[triangleIdx * 3 + 1],
            this.triangleElements[triangleIdx * 3 + 2],
        ];
        const triangleDegree = this.triangleDegrees[triangleIdx];

        // Add the new triangle
        const newTriangleIdx = this.triangleDegrees.length;
        this.triangleElements.push(
            triangleElements[2],
            triangleElements[0],
            newVertexIdx,
        );
        this.triangleConnections.push(
            this.triangleConnections[triangleIdx * 3 + 2],
            -1, // Connected later
            triangleIdx * 3 + 1,
        );
        this.triangleDegrees.push(triangleDegree + 1);

        // Update the original triangle
        this.triangleElements[triangleIdx * 3] = triangleElements[1];
        this.triangleElements[triangleIdx * 3 + 1] = triangleElements[2];
        this.triangleElements[triangleIdx * 3 + 2] = newVertexIdx;

        this.triangleConnections[triangleIdx * 3] =
            this.triangleConnections[triangleIdx * 3 + 1];
        this.triangleConnections[triangleIdx * 3 + 1] = newTriangleIdx * 3 + 2;
        this.triangleConnections[triangleIdx * 3 + 2] = -1; // Connected later

        this.triangleDegrees[triangleIdx] = triangleDegree + 1;

        // Re-connect triangles that used to be connected to the non-base edges
        // of the original triangle to the base edges of the new triangles
        for (const updatedTriangleIdx of [triangleIdx, newTriangleIdx]) {
            const edgeIdx = updatedTriangleIdx * 3;
            const connectedEdgeIdx = this.triangleConnections[edgeIdx];
            if (connectedEdgeIdx !== -1) {
                this.triangleConnections[connectedEdgeIdx] = edgeIdx;
            }
        }

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
