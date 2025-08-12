#!/bin/bash

# Liste des hooks React à importer
HOOKS="forwardRef useState useEffect useContext useCallback useMemo useId createContext useRef"

for file in client/src/components/ui/*.tsx; do
    # Vérifier si le fichier contient des hooks
    hooks_needed=""
    for hook in $HOOKS; do
        if grep -q "\\b$hook\\b" "$file"; then
            if [ -z "$hooks_needed" ]; then
                hooks_needed="$hook"
            else
                hooks_needed="$hooks_needed, $hook"
            fi
        fi
    done
    
    # Si des hooks sont nécessaires, mettre à jour l'import
    if [ ! -z "$hooks_needed" ]; then
        if grep -q "import React from \"react\"" "$file"; then
            sed -i.tmp "s/import React from \"react\"/import React, { $hooks_needed } from \"react\"/" "$file"
            echo "Updated $file with hooks: $hooks_needed"
        fi
    fi
done
