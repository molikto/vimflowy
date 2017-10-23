import * as React from 'react'; // tslint:disable-line no-unused-variable
import * as katex from 'katex';
import 'katex/dist/katex.min.css';

import { Tokenizer, Token, RegexTokenizerSplitter, EmitFn } from '../../assets/ts/utils/token_unfolder';
import { registerPlugin, PluginApi } from '../../assets/ts/plugins';
import { matchWordRegex } from '../../assets/ts/utils/text';

let currentMacrosString = '';
let currentMacros: {};

function isLetter(str: string) {
  return str.length === 1 && str.match(/[a-zA-Z]/i);
}

function updateMacrosObjectFromString(s: string) {
  currentMacrosString = s;
  let m: any = {};
  s.split('\n').forEach(function (line: string) {
    if (!line.startsWith('%')) {
      line = line.trim();
      if (line.startsWith('\\def')) {
        line = line.substring('\\def'.length).trim();
        if (line.startsWith('\\')) {
          line = line.substring(1);
          let index = 1;
          while (isLetter(line.charAt(index))) {
            index += 1;
          }
          const key = '\\' + line.substring(0, index);
          const command = line.substring(index).trim();
          m[key] = command;
        }
      }
    }
  });
  currentMacros = m;
}

type Props = {
  api: PluginApi,

};
type State = {
  macroString: string
};


function initMacroTextAreaValue() {
  const dom = document.getElementById('latex-macro-settings-input');
  if (dom instanceof HTMLTextAreaElement && dom != null) {
    dom.value = currentMacrosString;
  }
}
export default class MacroSettingsComponent extends React.Component<Props, State> {


  constructor(props: Props) {
    super(props);
    this.state = {
      macroString: currentMacrosString
    };
  }

  public onSubmit() {
    const dom = document.getElementById('latex-macro-settings-input');
    if (dom instanceof HTMLTextAreaElement && dom != null) {
      const str = dom.value;
      this.props.api.setData('macros', str);
      updateMacrosObjectFromString(str);
    }
  }

  public onCancel() {
    initMacroTextAreaValue();
  }

  public render() {
    const self = this;
    return <div>
        <span>Macros</span>
        <textarea id='latex-macro-settings-input' defaultValue={currentMacrosString}/>
        <button onClick={() => self.onSubmit() }>submit</button>
        <button onClick= {() => self.onCancel() }>cancel</button>
    </div>;
  }
}

registerPlugin(
  {
    name: 'LaTeX',
    author: 'Jeff Wu',
    description: `
      Lets you inline LaTeX between $ delimiters,
      or add block LaTeX between $$ delimiters.
      Limited to what KaTeX supports.
    `,
  },
  function (api) {
    api.getData('macros', '').then(data => {
      console.log(data);
      updateMacrosObjectFromString(data);
      initMacroTextAreaValue();
    });
    api.registerHook('session', 'renderLineTokenHook', (tokenizer, info) => {
      if (info.has_cursor) {
        return tokenizer;
      }
      if (info.has_highlight) {
        return tokenizer;
      }
      return tokenizer.then(RegexTokenizerSplitter(
        matchWordRegex('\\$\\$(\\n|.)+?\\$\\$'),
        (token: Token, emit: EmitFn<React.ReactNode>, wrapped: Tokenizer) => {
          try {
            const option: any = {
              displayMode: true,
              macros: currentMacros
            };
            console.log(option);
            const html = katex.renderToString(token.text.slice(2, -2), option);
            emit(<div key={`latex-${token.index}`} dangerouslySetInnerHTML={{ __html: html }} />);
          } catch (e) {
            api.session.showMessage(e.message, { text_class: 'error' });
            emit(...wrapped.unfold(token));
          }
        }
      )).then(RegexTokenizerSplitter(
        matchWordRegex('\\$(\\n|.)+?\\$'),
        (token: Token, emit: EmitFn<React.ReactNode>, wrapped: Tokenizer) => {
          try {
            const option: any = {
              displayMode: false,
              macros: currentMacros
            };
            const html = katex.renderToString(token.text.slice(1, -1), option);
            emit(<span key={`latex-${token.index}`} dangerouslySetInnerHTML={{ __html: html }} />);
          } catch (e) {
            api.session.showMessage(e.message, { text_class: 'error' });
            emit(...wrapped.unfold(token));
          }
        }
      ));
    });
  },
  function (api) {
    currentMacrosString = '';
    currentMacros = {};
    api.deregisterAll();
  },
  function (api) {
    const a = api;
    return <MacroSettingsComponent
      api={a}
    />;
  }
);
