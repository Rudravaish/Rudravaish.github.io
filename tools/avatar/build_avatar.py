"""Make Rudra's rigged game character with fitted, smooth clothing geometry."""

import math
import importlib
import os
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[2]
TOOLS = Path(__file__).resolve().parent
SOURCES = Path(os.environ.get('QUATERNIUS_ASSETS', str(ROOT / 'asset-sources')))
OUTPUT = ROOT / 'build/avatar'
sys.path.insert(0, str(TOOLS))
import avatar_face_likeness
import avatar_hair_likeness
shape_face_likeness = importlib.reload(avatar_face_likeness).shape_face_likeness
enhance_hair_likeness = importlib.reload(avatar_hair_likeness).enhance_hair_likeness
PACK = SOURCES / 'base/Universal Base Characters[Standard]'
BASE = PACK / 'Base Characters/Godot - UE/Superhero_Male_FullBody.gltf'
HAIR = PACK / 'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_SimpleParted.gltf'
HAIR_TEXTURE = TOOLS / 'hair-rudra-dark.png'
SKIN_TEXTURE = PACK / 'Base Characters/Textures/T_Superhero_Male_Dark.png'
BLEND = OUTPUT / 'rudra-avatar.blend'
GLB = ROOT / 'public/assets/rudra-avatar.glb'


def material(name, color, roughness=0.92):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat


def skinned_mesh(name, vertices, faces, mat, body, rig, weights=None):
    mesh = bpy.data.meshes.new(name + '_mesh')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    group_map = {group.index: obj.vertex_groups.new(name=group.name)
                 for group in body.vertex_groups}
    group_by_name = {group.name: obj.vertex_groups[group.name]
                     for group in body.vertex_groups}
    if weights is None:
        tree = KDTree(len(body.data.vertices))
        for index, vertex in enumerate(body.data.vertices):
            tree.insert(vertex.co, index)
        tree.balance()
    for index, vertex in enumerate(mesh.vertices):
        if weights is None:
            _, nearest, _ = tree.find(vertex.co)
            for group in body.data.vertices[nearest].groups:
                if group.weight > 0:
                    group_map[group.group].add([index], group.weight, 'REPLACE')
        else:
            for bone, value in weights(vertex.co, index).items():
                if value > 0:
                    group_by_name[bone].add([index], value, 'REPLACE')
    obj.parent = rig
    modifier = obj.modifiers.new('Rudra body rig', 'ARMATURE')
    modifier.object = rig
    return obj


def ring_loft(name, rings, sides, mat, body, rig, wave=0, weights=None):
    vertices = []
    for ring_index, (z, cx, cy, rx, ry) in enumerate(rings):
        for i in range(sides):
            angle = 2 * math.pi * i / sides
            wrinkle = 1 + wave * math.sin(7 * angle + 1.9 * ring_index)
            vertices.append((cx + rx * math.cos(angle) * wrinkle,
                             cy + ry * math.sin(angle) * wrinkle,
                             z))
    faces = []
    for ring_index in range(len(rings) - 1):
        for i in range(sides):
            a = ring_index * sides + i
            b = ring_index * sides + (i + 1) % sides
            c = (ring_index + 1) * sides + (i + 1) % sides
            d = (ring_index + 1) * sides + i
            faces.append((a, b, c, d))
    return skinned_mesh(name, vertices, faces, mat, body, rig, weights)


def fitted_shell(name, body, rig, fabric, bounds, offset):
    """Cut the actual human mesh into a garment, preserving its bone weights.

    Every cut vertex interpolates the source skinning weights. Unlike separate
    cylinders, the shoulders, crotch, knees and elbows keep the body's shape.
    """
    group_names = {group.index: group.name for group in body.vertex_groups}
    source = {}
    for vertex in body.data.vertices:
        source[vertex.index] = {
            'p': vertex.co.copy(),
            'n': vertex.normal.copy(),
            'w': {group_names[group.group]: group.weight
                  for group in vertex.groups if group.weight > 0},
        }

    def between(a, b, fraction):
        return {
            'p': a['p'].lerp(b['p'], fraction),
            'n': a['n'].lerp(b['n'], fraction).normalized(),
            'w': {bone: a['w'].get(bone, 0) * (1-fraction) +
                         b['w'].get(bone, 0) * fraction
                  for bone in set(a['w']) | set(b['w'])},
        }

    def clip(polygon, axis, edge, sign):
        if not polygon:
            return []
        output = []
        previous = polygon[-1]
        previous_distance = sign * (previous['p'][axis] - edge)
        for current in polygon:
            current_distance = sign * (current['p'][axis] - edge)
            previous_inside = previous_distance >= -1e-7
            current_inside = current_distance >= -1e-7
            if previous_inside != current_inside:
                fraction = previous_distance / (previous_distance-current_distance)
                output.append(between(previous, current, fraction))
            if current_inside:
                output.append(current)
            previous, previous_distance = current, current_distance
        return output

    vertices, weights, faces = [], [], []
    existing = {}
    for polygon in body.data.polygons:
        clipped = [source[index] for index in polygon.vertices]
        for axis, edge, sign in bounds:
            clipped = clip(clipped, axis, edge, sign)
            if len(clipped) < 3:
                break
        if len(clipped) < 3:
            continue
        indices = []
        for point in clipped:
            pos = point['p'] + point['n'] * offset(point['p'])
            if 'Tee' in name and pos.z < 1.06:
                drape = min(1, max(0, (1.06-pos.z)/.18))
                pos.x *= 1 + .035*drape
                pos.y *= 1 + .035*drape
            if 'Jeans' in name and pos.z < .82:
                # Ease the denim away from the calves and knees without
                # widening the hips or turning each leg into a straight tube.
                fullness = .045 + .07*min(1, max(0, (.65-pos.z)/.50))
                leg_center = .115 if pos.x >= 0 else -.115
                pos.x = leg_center + (pos.x-leg_center)*(1+fullness)
                pos.y *= 1+fullness
            key = tuple(round(float(component), 5) for component in pos)
            if key not in existing:
                existing[key] = len(vertices)
                vertices.append(tuple(pos))
                weights.append(point['w'])
            index = existing[key]
            if not indices or indices[-1] != index:
                indices.append(index)
        if len(indices) > 2 and indices[0] == indices[-1]:
            indices.pop()
        if len(set(indices)) >= 3:
            faces.append(tuple(indices))

    return skinned_mesh(name, vertices, faces, fabric, body, rig,
                        weights=lambda vertex, index: weights[index])


def tee_mesh(body, rig, fabric, collar):
    # The upper ring slopes to a crew neck, avoiding the jagged cut line that
    # appeared when a shirt was cut out of the source body's triangles.
    rings = [
        (0.88, .000, .000, .266, .155),
        (0.92, .000, .000, .260, .151),
        (0.96, .000, .000, .252, .147),
        (1.08, .000, .000, .243, .147),
        (1.22, .000, .000, .265, .155),
        (1.34, .000, .000, .288, .160),
        (1.43, .000, .000, .294, .153),
        (1.49, .000, .000, .298, .153),
        (1.53, .000, .000, .260, .143),
        (1.565, .000, .000, .195, .120),
        (1.585, .000, .000, .112, .096),
    ]
    sides = 32
    vertices = []
    for ri, (z, cx, cy, rx, ry) in enumerate(rings):
        for i in range(sides):
            angle = 2 * math.pi * i / sides
            neck_offset = .012 * math.sin(angle) if ri == len(rings) - 1 else 0
            vertices.append((cx + rx * math.cos(angle),
                             cy + ry * math.sin(angle), z + neck_offset))
    faces = []
    for ri in range(len(rings) - 1):
        for i in range(sides):
            faces.append((ri*sides+i, ri*sides+(i+1)%sides,
                          (ri+1)*sides+(i+1)%sides, (ri+1)*sides+i))
    skinned_mesh('Rudra_Black_Crewneck_Tee', vertices, faces, fabric, body, rig)

    # Independent short sleeves overlap the torso at the armhole. Their inner
    # loops are hidden by the torso and inherit the appropriate arm weights.
    for side, side_name in ((-1, 'R'), (1, 'L')):
        vertices = []
        sections = ((.25, 1.465, .125, .122),
                    (.35, 1.467, .119, .119),
                    (.46, 1.462, .111, .109),
                    (.51, 1.456, .105, .103))
        for x, cz, yr, zr in sections:
            for i in range(24):
                angle = 2 * math.pi * i / 24
                vertices.append((side * x, yr * math.cos(angle),
                                 cz + zr * math.sin(angle)))
        faces = []
        for s in range(len(sections)-1):
            for i in range(24):
                face = (s*24+i, s*24+(i+1)%24,
                        (s+1)*24+(i+1)%24, (s+1)*24+i)
                faces.append(face if side > 0 else tuple(reversed(face)))
        arm = 'upperarm_l' if side > 0 else 'upperarm_r'
        clavicle = 'clavicle_l' if side > 0 else 'clavicle_r'
        skinned_mesh('Rudra_Short_Sleeve_' + side_name, vertices, faces,
                     fabric, body, rig,
                     weights=lambda vertex, index, arm=arm, clavicle=clavicle:
                     {arm: .85 if abs(vertex.x) < .34 else 1.0,
                      clavicle: .15 if abs(vertex.x) < .34 else 0.0})

    collar_rings = ((1.583,0,0,.113,.097), (1.592,0,0,.106,.089))
    ring_loft('Rudra_Crewneck_Trim', collar_rings, 32, collar, body, rig)
    ring_loft('Rudra_Shirt_Hem', ((.875,0,0,.268,.157),
                                 (.893,0,0,.265,.156)), 32, collar, body, rig)


def jeans_mesh(body, rig, denim, seams):
    # A smooth hip section and two independently skinned loose legs follow the
    # pelvis and thighs during walking.
    hip = ((.85,0,0,.235,.135), (.92,0,0,.247,.145),
           (.99,0,0,.244,.142))
    ring_loft('Rudra_Jeans_Waist_And_Hips', hip, 32, denim, body, rig,
              weights=lambda vertex, index: {'pelvis': 1.0})

    def leg_weights(vertex, side):
        # Keep each trouser leg on its own bones. Nearest-surface transfer
        # occasionally takes weights from the opposite thigh at the crotch.
        thigh = 'thigh_l' if side > 0 else 'thigh_r'
        calf = 'calf_l' if side > 0 else 'calf_r'
        foot = 'foot_l' if side > 0 else 'foot_r'
        keys = ((.14, {calf: .25, foot: .75}),
                (.28, {calf: 1.0}),
                (.39, {calf: 1.0}),
                (.51, {thigh: .5, calf: .5}),
                (.62, {thigh: 1.0}),
                (.74, {thigh: 1.0}),
                (.84, {thigh: .9, 'pelvis': .1}),
                (.92, {thigh: .8, 'pelvis': .2}))
        z = vertex.z
        if z <= keys[0][0]:
            return keys[0][1]
        if z >= keys[-1][0]:
            return keys[-1][1]
        for (z0, w0), (z1, w1) in zip(keys, keys[1:]):
            if z0 <= z <= z1:
                t = (z-z0)/(z1-z0)
                return {bone: w0.get(bone, 0)*(1-t) + w1.get(bone, 0)*t
                        for bone in set(w0) | set(w1)}
    for side, side_name in ((-1, 'R'), (1, 'L')):
        leg = [
            (.14, side*.118, -.003, .105, .107),
            (.18, side*.118, -.003, .107, .108),
            (.28, side*.118, -.002, .108, .105),
            (.39, side*.116, -.002, .109, .103),
            (.51, side*.115, -.002, .115, .107),
            (.62, side*.115, -.001, .124, .116),
            (.74, side*.116, -.001, .132, .122),
            (.84, side*.116, .000, .132, .125),
            (.92, side*.115, .000, .126, .122),
        ]
        ring_loft('Rudra_Light_Blue_Jeans_' + side_name,
                  leg, 24, denim, body, rig, wave=.018,
                  weights=lambda vertex, index, side=side:
                  leg_weights(vertex, side))
        ring_loft('Rudra_Jeans_Cuff_' + side_name,
                  ((.136,side*.118,-.003,.108,.109),
                   (.151,side*.118,-.003,.107,.108)),
                  24, seams, body, rig,
                  weights=lambda vertex, index, side=side:
                  leg_weights(vertex, side))
    ring_loft('Rudra_Denim_Waistband', ((.965,0,0,.246,.144),
                                        (.992,0,0,.244,.143)),
              32, seams, body, rig,
              weights=lambda vertex, index: {'pelvis': 1.0})


def shoe_mesh(body, rig, upper, sole):
    # A low-profile sneaker last: rounded toe, shaped heel, thin rubber edge.
    # Keep the lace and tongue surfaces close to the vamp instead of letting
    # them float above it, which made the old shoe read as a white block.
    midsole = material('Warm white foam midsole', (.76, .79, .80), .88)
    laces = material('Soft grey sneaker laces', (.65, .69, .71), .91)
    panel = material('Subtle grey sneaker side panel', (.68, .72, .74), .91)

    for side, side_name in ((-1, 'R'), (1, 'L')):
        center_x = side * .118
        foot_bone = 'foot_l' if side > 0 else 'foot_r'

        def add_part(suffix, vertices, faces, mat):
            return skinned_mesh('Rudra_Sneaker_' + suffix + '_' + side_name,
                                vertices, faces, mat, body, rig,
                                weights=lambda vertex, index:
                                {foot_bone: 1.0})

        def lengthwise_loft(suffix, sections, mat, sides=24):
            # Each section is (front-to-back y, half-width, bottom z, top z).
            vertices = []
            for y, half_width, bottom, top in sections:
                mid_z = (bottom + top) * .5
                half_height = (top - bottom) * .5
                for i in range(sides):
                    angle = 2 * math.pi * i / sides
                    vertices.append((center_x + half_width * math.cos(angle),
                                     y, mid_z + half_height * math.sin(angle)))
            faces = []
            for section in range(len(sections) - 1):
                for i in range(sides):
                    next_i = (i + 1) % sides
                    a = section * sides + i
                    b = (section + 1) * sides + i
                    faces.append((a, b, (section + 1) * sides + next_i,
                                  section * sides + next_i))
            # Close the toe and heel with small caps so glTF sees a solid mesh.
            faces.append(tuple(range(sides)))
            start = (len(sections) - 1) * sides
            faces.append(tuple(start + i for i in reversed(range(sides))))
            return add_part(suffix, vertices, faces, mat)

        lengthwise_loft('White_Upper', (
            (-.192, .008, .036, .052),
            (-.185, .030, .035, .064),
            (-.169, .050, .034, .078),
            (-.145, .065, .034, .092),
            (-.112, .072, .035, .105),
            (-.074, .073, .036, .117),
            (-.028, .071, .038, .130),
            ( .018, .068, .039, .140),
            ( .059, .061, .040, .141),
            ( .088, .050, .041, .127),
            ( .106, .029, .042, .087),
            ( .111, .008, .043, .058),
        ), upper)
        lengthwise_loft('White_Midsole', (
            (-.195, .009, .015, .036),
            (-.187, .033, .013, .037),
            (-.169, .054, .011, .037),
            (-.144, .070, .010, .038),
            (-.110, .077, .010, .039),
            (-.070, .078, .011, .040),
            (-.026, .076, .012, .041),
            ( .020, .073, .013, .043),
            ( .061, .066, .014, .044),
            ( .091, .053, .015, .045),
            ( .109, .030, .017, .045),
            ( .115, .009, .020, .044),
        ), midsole)
        lengthwise_loft('Grey_Outsole', (
            (-.195, .008, .008, .019),
            (-.187, .033, .006, .018),
            (-.169, .054, .004, .017),
            (-.144, .070, .003, .016),
            (-.110, .077, .003, .016),
            (-.070, .078, .003, .017),
            (-.026, .076, .004, .018),
            ( .020, .073, .005, .019),
            ( .061, .066, .006, .020),
            ( .091, .053, .007, .021),
            ( .109, .030, .009, .022),
            ( .115, .008, .011, .022),
        ), sole)

        # The tongue follows the instep's curve, only a few millimeters proud
        # of the leather upper. The laces therefore sit on the shoe itself.
        tongue_rows = ((-.105, .026, .110), (-.070, .029, .122),
                       (-.035, .030, .132), ( .005, .030, .142))
        tongue_vertices = []
        for y, width, height in tongue_rows:
            tongue_vertices.extend(((center_x - width, y, height - .006),
                                    (center_x, y, height),
                                    (center_x + width, y, height - .006)))
        tongue_faces = []
        for row in range(len(tongue_rows) - 1):
            for column in range(2):
                a = row * 3 + column
                tongue_faces.append((a, a + 1, a + 4, a + 3))
        add_part('Tongue', tongue_vertices, tongue_faces, upper)

        for lace_index, (y, height) in enumerate(((-.090, .117),
                                                   (-.067, .125),
                                                   (-.044, .133),
                                                   (-.021, .140))):
            half_width = .026 - lace_index * .001
            vertices = ((center_x - half_width, y - .0017, height - .002),
                        (center_x, y - .0017, height + .001),
                        (center_x + half_width, y - .0017, height - .002),
                        (center_x - half_width, y + .0017, height - .002),
                        (center_x, y + .0017, height + .001),
                        (center_x + half_width, y + .0017, height - .002))
            faces = ((0, 1, 4, 3), (1, 2, 5, 4))
            add_part('Lace_' + str(lace_index + 1), vertices, faces, laces)

        # A narrow tonal side detail gives the upper a readable panel at the
        # character's map-view size without a chunky separate heel piece.
        for outboard in (-1, 1):
            detail = ((-.092, .071, .078), (-.045, .072, .085),
                      ( .003, .070, .092), ( .052, .063, .095))
            vertices = []
            for y, width, z in detail:
                x = center_x + outboard * (width + .0015)
                vertices.extend(((x, y, z - .003), (x, y, z + .003)))
            faces = [(i*2, (i+1)*2, (i+1)*2+1, i*2+1)
                     for i in range(len(detail)-1)]
            if outboard < 0:
                faces = [tuple(reversed(face)) for face in faces]
            add_part('Side_Panel_' + ('Outer' if outboard > 0 else 'Inner'),
                     vertices, faces, panel)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    GLB.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(BASE))
    rig = next(obj for obj in bpy.data.objects if obj.type == 'ARMATURE')
    body = bpy.data.objects['SuperHero_Male']
    body.name = 'Rudra_Body'
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and obj.name.startswith('Icosphere'):
            bpy.data.objects.remove(obj, do_unlink=True)

    shape_face_likeness(body, bpy.data.objects.get('Eyes'),
                        bpy.data.objects.get('Eyebrows'))

    skin_image = bpy.data.images.load(str(SKIN_TEXTURE), check_existing=True)
    for material_slot in body.data.materials:
        if material_slot and material_slot.use_nodes:
            for node in material_slot.node_tree.nodes:
                if (node.type == 'TEX_IMAGE' and node.image and
                        ('BaseColor' in node.image.name or
                         'T_Superhero_Male_Dark' in node.image.name or
                         'T_Superhero_Male_Ligh' in node.image.name)):
                    node.image = skin_image

    fabric = material('Matte black cotton', (.017,.020,.025), .97)
    trim = material('Black collar and hem', (.010,.012,.016), .93)
    denim = material('Faded light blue denim', (.33,.51,.67), .98)
    seams = material('Blue denim seams', (.27,.44,.59), .98)
    shoe = material('Soft white leather sneaker', (.83,.85,.86), .78)
    sole = material('Light grey rubber sole', (.66,.69,.71), .92)

    # Color the source body beneath garments so a small overlap cannot expose
    # skin as the rig flexes during movement.
    for mat in (fabric, denim, shoe):
        body.data.materials.append(mat)
    fabric_index, denim_index, shoe_index = range(1,4)
    for poly in body.data.polygons:
        p = poly.center
        if p.z < .15:
            poly.material_index = shoe_index
        elif p.z < .995 and abs(p.x) < .47:
            poly.material_index = denim_index
        elif .88 < p.z < 1.58 and (
                (p.z < 1.55 and abs(p.x) < .44) or
                (p.z >= 1.55 and .13 < abs(p.x) < .43)):
            poly.material_index = fabric_index

    fitted_shell('Rudra_Black_Fitted_Tee', body, rig, fabric,
                 ((2, .925, 1), (2, 1.58, -1),
                  (0, -.47, 1), (0, .47, -1)),
                 lambda p: .026 + .015*min(1, max(0, (1.07-p.z)/.18)))
    fitted_shell('Rudra_Light_Blue_Fitted_Jeans', body, rig, denim,
                 ((2, .14, 1), (2, .98, -1)),
                 lambda p: .027 + .016*min(1, max(0, (.55-p.z)/.41)))
    shoe_mesh(body, rig, shoe, sole)

    # The shoes replace the base mesh's bare feet. Remove those toe surfaces
    # so they cannot peek beneath the sneaker soles in walking poses.
    bm = bmesh.new()
    bm.from_mesh(body.data)
    foot_faces = [face for face in bm.faces
                  if face.calc_center_median().z < .145]
    bmesh.ops.delete(bm, geom=foot_faces, context='FACES')
    bm.to_mesh(body.data)
    bm.free()
    body.data.update()

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(HAIR))
    new_objects = [obj for obj in bpy.data.objects if obj not in before]
    hair_meshes = [obj for obj in new_objects if obj.type == 'MESH' and
                   'hair' in obj.name.lower()]
    dark_hair = bpy.data.images.load(str(HAIR_TEXTURE), check_existing=True)
    for hair in hair_meshes:
        hair.name = 'Rudra_Short_Dark_Hair'
        world = hair.matrix_world.copy()
        hair.parent = rig
        hair.matrix_world = world
        for modifier in hair.modifiers:
            if modifier.type == 'ARMATURE':
                modifier.object = rig
        for mat in hair.data.materials:
            if mat and mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image and 'BaseColor' in node.image.name:
                        node.image = dark_hair
    for obj in new_objects:
        if obj.type == 'ARMATURE' or (obj.type == 'MESH' and obj not in hair_meshes):
            bpy.data.objects.remove(obj, do_unlink=True)
    enhance_hair_likeness(bpy, rig, hair_meshes)

    # The source parted hairstyle leaves a small opening between its raised
    # locks. Cover only the upper scalp with a dark, head-skinned underlayer so
    # the skin cannot peek through when the camera looks down on the avatar.
    scalp_mat = hair_meshes[0].data.materials[0] if hair_meshes else material(
        'Rudra_Dark_Hair_Roots', (.009, .008, .008), .88)
    scalp_cap = fitted_shell('Rudra_Hair_Root_Underlayer', body, rig, scalp_mat,
                            [(2, 1.765, 1), (0, -.065, 1), (0, .102, -1),
                             (1, -.112, 1), (1, .112, -1)],
                            lambda p: .0018)
    scalp_uv = scalp_cap.data.uv_layers.new(name='Hair roots UV')
    for loop in scalp_cap.data.loops:
        p = scalp_cap.data.vertices[loop.vertex_index].co
        scalp_uv.data[loop.index].uv = (.5 + p.x * .9, .5 + p.y * .9)
    brows = bpy.data.objects.get('Eyebrows')
    if brows:
        for mat in brows.data.materials:
            if mat and mat.use_nodes:
                for node in mat.node_tree.nodes:
                    if node.type == 'TEX_IMAGE' and node.image and 'BaseColor' in node.image.name:
                        node.image = dark_hair

    for bone in rig.pose.bones:
        bone.custom_shape = None
    for obj in list(bpy.data.objects):
        if obj.type == 'MESH' and obj.name.startswith('Icosphere'):
            bpy.data.objects.remove(obj, do_unlink=True)
    rig.name = 'Rudra_Rig'
    rig.data.display_type = 'STICK'
    rig.show_in_front = False
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = None
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
    bpy.ops.export_scene.gltf(filepath=str(GLB), export_format='GLB',
                              export_animations=False)
    (OUTPUT / 'build-report.txt').write_text('\n'.join([
        f'Blend: {BLEND}', f'GLB: {GLB}',
        f'Meshes: {[(o.name, len(o.data.polygons)) for o in bpy.data.objects if o.type == "MESH"]}',
        f'Hair meshes: {[o.name for o in hair_meshes]}',
        f'Armature: {rig.name}',
    ]))
    print('RUDRA_AVATAR_BUILT_V2', GLB)


if __name__ == '__main__':
    main()
