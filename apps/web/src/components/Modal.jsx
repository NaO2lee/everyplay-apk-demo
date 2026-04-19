import { createContext, useContext, useState, useCallback } from 'react';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [state, setState] = useState(null);
  // state: { type: 'alert'|'confirm'|'select', message, options, resolve }

  const showAlert = useCallback((message) => {
    return new Promise(resolve => {
      setState({ type: 'alert', message, resolve });
    });
  }, []);

  const showConfirm = useCallback((message) => {
    return new Promise(resolve => {
      setState({ type: 'confirm', message, resolve });
    });
  }, []);

  const showSelect = useCallback((title, options) => {
    // options: [{label, value}]
    return new Promise(resolve => {
      setState({ type: 'select', message: title, options, resolve });
    });
  }, []);

  const close = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ModalContext.Provider value={{ alert: showAlert, confirm: showConfirm, select: showSelect }}>
      {children}
      {state && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            {/* Message */}
            <p className="text-sm text-gray-800 whitespace-pre-wrap mb-4">{state.message}</p>

            {/* Alert: OK only */}
            {state.type === 'alert' && (
              <div className="flex justify-end">
                <button onClick={() => close(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">확인</button>
              </div>
            )}

            {/* Confirm: 확인 + 취소 */}
            {state.type === 'confirm' && (
              <div className="flex justify-end gap-2">
                <button onClick={() => close(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">취소</button>
                <button onClick={() => close(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600">확인</button>
              </div>
            )}

            {/* Select: option buttons */}
            {state.type === 'select' && (
              <div className="space-y-2">
                {state.options.map(opt => (
                  <button key={opt.value} onClick={() => close(opt.value)}
                    className="w-full text-left px-4 py-2.5 border rounded-lg text-sm hover:bg-blue-50 hover:border-blue-200">
                    {opt.label}
                  </button>
                ))}
                <button onClick={() => close(null)} className="w-full px-4 py-2 text-gray-500 text-sm hover:bg-gray-50 rounded-lg">취소</button>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
