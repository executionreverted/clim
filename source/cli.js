#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
  `

	`,
  {
    importMeta: import.meta,
  },
);

render(<App name={cli.flags.name} />);
