"""Gentle sculpt adjustments to bring the game avatar closer to Rudra's portrait.

The single supplied photograph is dark and red-lit, so these edits follow
visible proportions and expression rather than trying to infer exact skin
color or the unseen side profile.
"""

import math


def _gauss(value, center, radius):
    return math.exp(-((value - center) / radius) ** 2)


def _clamp(value):
    return max(0.0, min(1.0, value))


def shape_face_likeness(body, eyes, brows):
    """Round the cheeks/jaw and soften the severe expression in the base mesh.

    All shifts are small and smooth.  The topology, UVs and skinning weights
    remain intact, so the original rig and game animations still work.
    """
    changed = 0
    for vertex in body.data.vertices:
        p = vertex.co
        x, y, z = float(p.x), float(p.y), float(p.z)
        if not 1.555 < z < 1.735 or not -.14 < y < .035:
            continue
        side = 1.0 if x >= 0 else -1.0
        ax = abs(x)
        front = _clamp((.012 - y) / .068)

        # The stock superhero has a hollow, sharply angled lower face.
        # Add volume to the mid and lower cheek without moving the eyes.
        cheek = (_gauss(ax, .064, .027) *
                 _gauss(z, 1.660, .039) * front)
        lower_cheek = (_gauss(ax, .051, .025) *
                       _gauss(z, 1.625, .028) * front)
        p.x += side * (.0054 * cheek + .0037 * lower_cheek)
        p.y -= .0031 * cheek + .0015 * lower_cheek

        # His eyes sit in a gentler, narrower almond opening than the source
        # character's wide heroic stare.  Bring both lids toward the iris;
        # the eye mesh remains behind them and keeps its rigging.
        eye_lid = (_gauss(ax, .036, .024) *
                   _gauss(z, 1.700, .020) *
                   _clamp((-.047 - y) / .031))
        p.z -= (z - 1.700) * .18 * eye_lid

        # Shorter, softer chin rather than the long square superhero chin.
        chin = (_gauss(ax, 0.0, .050) *
                _gauss(z, 1.579, .022) * front)
        p.z += .0058 * chin
        p.y += .0018 * chin

        # Round the nasal tip and make the nostril area modestly wider.
        nose = (_gauss(ax, .014, .019) *
                _gauss(z, 1.655, .019) *
                _clamp((-.073 - y) / .035))
        p.x += side * .0019 * nose
        p.y += .0021 * nose

        # A closed, slight smile: lift only the outer edges of the mouth.
        smile = (_gauss(ax, .032, .014) *
                 _gauss(z, 1.625, .012) *
                 _clamp((-.050 - y) / .03))
        p.z += .0026 * smile
        p.y -= .0008 * smile
        changed += 1
    body.data.update()

    # Eye geometry is separate from the face.  Leaving it in place preserves
    # alignment while the cheek, jaw, nose and mouth change around it.
    if eyes:
        eyes.data.update()

    # The source brows slope down toward the nose, giving an angry look.
    # Raise their inner ends into a relaxed, nearly level shape.
    if brows:
        for vertex in brows.data.vertices:
            p = vertex.co
            inner = _gauss(abs(float(p.x)), .008, .024)
            p.z = 1.710 + (p.z - 1.710) * .82 + .0057 * inner
            p.y += .0009 - .0006 * inner
        brows.data.update()
    return changed
