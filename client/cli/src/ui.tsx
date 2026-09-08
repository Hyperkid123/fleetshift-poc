import { Box, Text } from "ink";
import React from "react";

export function Output({
  value,
  error = false,
}: {
  value: string;
  error?: boolean;
}): React.ReactElement {
  return (
    <Box>
      <Text color={error ? "red" : undefined}>{value}</Text>
    </Box>
  );
}

export function JsonOutput({ value }: { value: unknown }): React.ReactElement {
  return <Output value={JSON.stringify(value, null, 2)} />;
}
