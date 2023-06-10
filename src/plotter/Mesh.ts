export type Mesh = {
    vertices: Vertex[];
    triangles: Triangle[];
};
export type Vertex = [x: number, y: number, value: number];
export type Triangle = [number, number, number];
