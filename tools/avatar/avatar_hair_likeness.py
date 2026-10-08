"""Soften the imported parted haircut toward a short, forward style.

Call ``enhance_hair_likeness(bpy, rig, hair_meshes)`` after the imported
Hair_SimpleParted hair has been parented to the avatar rig and before export.
The helper keeps the original UVs, rig weights, world and clothes intact.
"""

import math


def _clamp(value):
    return max(0.0, min(1.0, value))


def enhance_hair_likeness(bpy, rig, hair_meshes):
    """Soften and bring forward the source haircut while preserving its UVs."""
    head_bone = next((bone for bone in rig.data.bones
                      if bone.name.lower() == 'head'), None)
    meshes = [obj for obj in hair_meshes if obj and obj.type == 'MESH']
    if head_bone is None or not meshes:
        return None

    rig_from_world = rig.matrix_world.inverted()
    samples = []
    for hair in meshes:
        to_rig = rig_from_world @ hair.matrix_world
        samples.extend(to_rig @ vertex.co for vertex in hair.data.vertices)
    if not samples:
        return None

    left = min(point.x for point in samples)
    right = max(point.x for point in samples)
    front = min(point.y for point in samples)
    top = max(point.z for point in samples)
    center_x = (left + right) * .5
    half_width = (right - left) * .5

    # Preserve the original textured geometry and UVs. These small changes
    # lower its formal swept crown and bring the leading edge forward.
    for hair in meshes:
        to_rig = rig_from_world @ hair.matrix_world
        from_rig = to_rig.inverted()
        for vertex in hair.data.vertices:
            point = to_rig @ vertex.co
            crown = _clamp((point.z - (top - .083)) / .083)
            leading = _clamp((front + .052 - point.y) / .052)
            center = 1 - _clamp(abs(point.x - center_x) / (half_width * .9))
            fringe = leading * center * math.exp(-((point.z-(top-.075))/.05)**2)
            point.z -= .009 * crown * crown + .009 * fringe
            point.y -= .0055 * leading * (.3 + .7 * crown) + .004 * fringe
            point.x = center_x + (point.x - center_x) * (1 + .018*crown)
            vertex.co = from_rig @ point
        hair.data.update()

    return None
