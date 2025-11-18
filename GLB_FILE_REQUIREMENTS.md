// This is a simple example GLB file that can be created using Blender or other 3D tools
// For now, I'll create a note about how to obtain GLB files

/\*
GLB File Requirements:

To use this GLB viewer, you need to replace the existing .ifc files with .glb files.
Here are the recommended ways to obtain GLB files:

1. Convert from IFC using tools like:

   - Blender (with IFC import/GLB export plugins)
   - FreeCAD
   - IfcOpenShell
   - Online converters

2. Export directly from CAD software:

   - Autodesk Revit (using GLB export plugins)
   - SketchUp
   - 3ds Max
   - Maya

3. Use online conversion services:
   - Various online IFC to GLB converters
   - Autodesk Viewer API

The GLB files should be placed in the respective project folders:

- /public/BSGS/\*.glb
- /public/CUP/\*.glb
- /public/LORRY/\*.glb

Each GLB file should represent a construction sequence step and be named according to the models.json manifest.
\*/
