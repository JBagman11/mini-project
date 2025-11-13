import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, Textarea } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import type { NodeData } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState("");
  const getJson = useJson(state => state.getJson);
  const setJson = useJson(state => state.setJson);
  const setContents = useFile(state => state.setContents);

  const startEdit = () => {
    if (!nodeData) return;
    if (nodeData.text.length === 1 && !nodeData.text[0].key) {
      const row = nodeData.text[0];
      if (row.type === "string") setEditValue(JSON.stringify(row.value ?? ""));
      else setEditValue(String(row.value ?? ""));
    } else {
      const obj: Record<string, any> = {};
      nodeData.text?.forEach(row => {
        if (row.type !== "array" && row.type !== "object") {
          if (row.key) obj[row.key] = row.value;
        }
      });
      setEditValue(JSON.stringify(obj, null, 2));
    }
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!nodeData) return;
    try {
      const { modify, parse, applyEdits } = await import("jsonc-parser");
      const current = getJson();
      let newValue: any = null;
      try {
        newValue = parse(editValue);
      } catch (e) {
        const trimmed = editValue.trim();
        if (trimmed === "null") newValue = null;
        else if (trimmed === "true") newValue = true;
        else if (trimmed === "false") newValue = false;
        else if (!Number.isNaN(Number(trimmed))) newValue = Number(trimmed);
        else newValue = trimmed;
      }
      const path = nodeData.path ?? [];
      const edits = modify(current, path as any, newValue, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      });
      const updated = applyEdits(current, edits);
      setJson(updated);
      try {
        setContents({ contents: updated, hasChanges: false, skipUpdate: true });
      } catch (e) {}
      setIsEditing(false);
    } catch (error) {
      console.error(error);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
  };

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex gap="xs">
              {!isEditing ? (
                <Button size="xs" variant="subtle" onClick={startEdit}>
                  Edit
                </Button>
              ) : (
                <>
                  <Button size="xs" color="green" onClick={saveEdit}>
                    Save
                  </Button>
                  <Button size="xs" color="gray" variant="subtle" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>
          <ScrollArea.Autosize mah={250} maw={600}>
            {!isEditing ? (
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            ) : (
              <Textarea
                minRows={6}
                maxRows={14}
                value={editValue}
                onChange={e => setEditValue(e.currentTarget.value)}
                autosize
              />
            )}
          </ScrollArea.Autosize>
        </Stack>
        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
