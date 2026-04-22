{
  description = "Exile - personal travel documentation app";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs_20
            exiftool
            just
          ];
          shellHook = ''
            echo "exile dev shell"
            echo "run 'just' to see available commands"
          '';
        };

        packages.default = pkgs.buildNpmPackage {
          pname = "exile";
          version = "0.1.0";
          src = ./.;
          npmDepsHash = "sha256-tdwHd6v1EEJqg+EQvMECLxkinmBsUKnzKB+jnhj1ckM=";
          buildPhase = ''
            npm run build
          '';
          installPhase = ''
            cp -r dist $out
          '';
        };
      });
}
