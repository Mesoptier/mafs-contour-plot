import { Vertex } from './Mesh';

function inverseMix(t: number, lo: number, hi: number): number {
    if (lo > hi) {
        return 1.0 - inverseMix(t, hi, lo);
    }
    return (t - lo) / (hi - lo);
}

function makeEndpoint(threshold: number, v1: Vertex, v2: Vertex): Vertex {
    const t = inverseMix(threshold, v1[2], v2[2]);
    return [
        v1[0] + (v2[0] - v1[0]) * t,
        v1[1] + (v2[1] - v1[1]) * t,
        v1[2] + (v2[2] - v1[2]) * t,
    ];
}

export function analyzeTriangle(
    triangle: [Vertex, Vertex, Vertex],
    threshold: number,
): [Vertex, Vertex] | null {
    const b1 = triangle[0][2] > threshold;
    const b2 = triangle[1][2] > threshold;
    const b3 = triangle[2][2] > threshold;

    if (b1 === b2) {
        if (b2 === b3) {
            return null;
        } else {
            return [
                makeEndpoint(threshold, triangle[0], triangle[2]),
                makeEndpoint(threshold, triangle[1], triangle[2]),
            ];
        }
    } else {
        if (b2 !== b3) {
            return [
                makeEndpoint(threshold, triangle[0], triangle[1]),
                makeEndpoint(threshold, triangle[2], triangle[1]),
            ];
        } else {
            return [
                makeEndpoint(threshold, triangle[1], triangle[0]),
                makeEndpoint(threshold, triangle[2], triangle[0]),
            ];
        }
    }
}
