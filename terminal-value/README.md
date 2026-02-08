# Terminal Value

An example implementation showcasing the power of "Transactional AI" usage.

The value flow looks like this:

Data -> Extract Key User Details -> Generate User-specific Prompts -> Generate Multi-modal User-specific Views -> Verify Confidence -> Serve

Actual functions that do stuff are:

parseValue -> generateValue -> generateAllHomePageComponents -> verifyConfidence
