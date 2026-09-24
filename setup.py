import os
import shutil
from setuptools import setup
from setuptools.command.build_py import build_py


class CustomBuildPy(build_py):
    """Custom build_py to bundle the offline web app and cover assets into the package distribution."""

    def run(self):
        super().run()
        base_dir = os.path.dirname(os.path.abspath(__file__))

        # Bundle web studio directory into slide_printer/web
        target_web = os.path.join(self.build_lib, "slide_printer", "web")
        src_web = os.path.join(base_dir, "web")
        if os.path.isdir(src_web):
            if os.path.exists(target_web):
                shutil.rmtree(target_web)
            shutil.copytree(src_web, target_web)

        # Bundle assets into slide_printer/assets
        target_assets = os.path.join(self.build_lib, "slide_printer", "assets")
        src_assets = os.path.join(base_dir, "slide_printer", "assets")
        if os.path.isdir(src_assets):
            if os.path.exists(target_assets):
                shutil.rmtree(target_assets)
            shutil.copytree(src_assets, target_assets)


setup(
    cmdclass={"build_py": CustomBuildPy},
)
