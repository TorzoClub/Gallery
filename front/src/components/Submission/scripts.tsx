import React, { CSSProperties, ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { AppCriticalError } from 'App'
import { confirmQQNum, getSubmissionByQQNum } from 'api/member'

import s from './scripts.module.scss'
import { disintegrate } from './thanos-disintegration'

import { componentScript, script, select, Script, Select, Content, useSubmissionStore, jumpScript, _EVENT_, scriptAdvance, TextContentEffect, textContentEffectTotalTime, ScriptPlayerSelects, RenderContent } from './'

import WaitingInputFrame from 'components/ConfirmQQ/WaitingInputFrame'
import { timeout } from 'new-vait'
import Loading from 'components/Loading'
import PhotoCreateOrEdit, { PreviewBox } from './PhotoCreateOrEdit'

import image_同装同装 from '../../assets/同装 同装.png'
import { PhotoInActive, PhotoNormal, cancelMySubmission, normal2InActive } from 'api/photo'
import { thunkify } from 'ramda'
import { useQueueload } from 'utils/queue-load'

export function init() {
  function RequestInputQQNumber(p: { loginSuccess: (qq_num: string) => Promise<void> }) {
    const [ failure, setFailure ] = useState<Error | null>(null)
    const [ loading, setLoading ] = useState(false)

    const submission_store = useSubmissionStore()
    console.log('submission_store', submission_store)

    return (
      <div style={{ position: 'relative', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
        <div style={{ width: '200px' }}>
          <WaitingInputFrame
            isFailure={Boolean(failure)}
            disabled={false}
            handleInputChange={() => {
              console.log('handleInputChange')
              setLoading(false)
              setFailure(null)
            }}
            handlesubmitDetect={async (qq_num) => {
              console.log('handlesubmitDetect')
              setLoading(true)
              try {
                const [confirmResult] = await Promise.all([confirmQQNum(Number(qq_num)), timeout(1500)])
                if (confirmResult) {
                  // ctx.stored_qq_num = qq_num
                  useSubmissionStore.setState({ qq_num })
                  // submission_store.setQQNum(qq_num)
                  await p.loginSuccess(qq_num)
                } else {
                  setFailure(new Error('朋友，你这个Q号不对，再看看？'))
                }
              } finally {
                setLoading(false)
              }
            }}
            placeholder="输入你的 QQ 号"
          />
        </div>
        { failure && failure.message }
        {loading && <div className="loading-wrapper">
          <Loading />
        </div>}
      </div>
    )
  }

  const iMistake = (): Script => {
    return script('哦哦不好意思搞错了，感谢参加！', [
      select('下次注意点，不要又忘了',
        script('好的！', [])
      ),
      select('话说，我想修改一下投稿，可以吗？', script_PhotoCreateOrEditWithTitle('当然可以！', 'EDIT', true)),
      select_我其实是想取消投稿
    ])
  }

  const iamJoinAfter = (PresetContent: Content): Script => {
    return script(PresetContent, [
      select('那我参加', submissionCheckingScript()),
      select('那好吧，我就随便看看', script_听说你在下周会来参加投票),
    ])
  }

  const submissionCheckingScript = (exists_text: Content = '你这不是已经投稿了吗？'): Script => {
    const { photo } = useSubmissionStore.getState()
    if (photo) {
      // 已经投稿了
      return componentScript([
        select('哦，我其实想修改的', script_PhotoCreateOrEditWithTitle('当然可以修改！', 'EDIT', true)),
        select_我其实是想取消投稿
      ], () => {
        return (
          <>
            <div style={{ marginBottom: '20px' }}>{exists_text}</div>
            <PreviewBox
              previewURL={photo.thumb_url}
              isDragging={false}
              height={320 / (photo.width / photo.height)}
            />
          </>
        )
      })
    } else {
      return componentScript([], ({ changeScript }) => {
        return <PhotoCreateOrEdit onUpdateDone={(created_photo) => {
          changeScript(script_感谢你的参与('CREATE', created_photo))
        }} />
      })
    }
  }

  const script_感谢你的参与 = (type: 'CREATE' | 'EDIT', photo: PhotoNormal) => {
    return componentScript([], ({ changeScript }) => {
      useEffect(() => {
        setTimeout(() => {
          console.log(type, photo)
          if (type === 'CREATE') {
            _EVENT_.created.trigger(normal2InActive(photo))
          } else {
            _EVENT_.updated.trigger(normal2InActive(photo))
          }
        }, 1500)
      }, [])
      return (
        <TextContentEffect
          textContent='感谢你的参与！'
          showContentWaittime={300}
        />
      )
    })
  }

  const script_PhotoCreateOrEditWithTitle = (title: string, type: 'CREATE' | 'EDIT', immediately = false) => componentScript([], ({ changeScript }) => {
    const [show_form, showForm] = useState(false)
    useEffect(() => {
      if (immediately == false) {
        const handler = setTimeout(() => {
          showForm(true)
        }, textContentEffectTotalTime(300 + 500, title))
        return () => clearTimeout(handler)
      }
    }, [])
    return <>
      <div style={{ marginBottom: '20px' }}>
        <TextContentEffect textContent={title} showContentWaittime={immediately ? 0 : 300} />
      </div>
      {
        (show_form || immediately) && (
          <PhotoCreateOrEdit onUpdateDone={(updated_photo) => {
            changeScript(script_感谢你的参与(type, updated_photo))
          }} />
        )
      }
    </>
  })

  const script_撤回确认 = () => {
    const timeline = {
      '什么？！你想取消投稿？': 500,
      get '撤回没逼品'() {
        return textContentEffectTotalTime(
          timeline['什么？！你想取消投稿？'],
          '什么？！你想取消投稿？'
        )
      },
      get '额好吧'() {
        return textContentEffectTotalTime(
          timeline['撤回没逼品'],
          '撤回没逼品',
          500
        )
      },
      get 'delete_line'() {
        return timeline['额好吧'] + 1000
      },
      get '可以的'() {
        return timeline['delete_line'] + 1000
      },
      get show_picture() {
        return 1000 + textContentEffectTotalTime(
          timeline['可以的'],
          '额，好吧。可以取消的，你确定真的要这样做吗？'
        )
      },
      get select_waittime() {
        return 1000 + timeline['show_picture']
      }
    }

    return scriptAdvance({
      show_select_timeout: 0,
      selects: [
      ],
      Content: ({ changeScript }) => {
        const [delete_line, setDeleteLine] = useState(false)
        useEffect(() => {
          const handler = setTimeout(() => {
            setDeleteLine(true)
          }, timeline.delete_line)
          return () => clearTimeout(handler)
        }, [])

        const selects = useMemo(() => (
          [
            select('是，取消掉吧', script('', [])),
            select('否，不要取消', script('你逗我玩是吧？', [
              select('我真的想参加', jumpScript(submissionCheckingScript, ['要做什么'])),
              select('我只是随便看看', script('呃呃呃......', []))
            ]))
          ]
        ), [])

        const { photo, qq_num } = useSubmissionStore.getState()
        const [ , blob_url ] = useQueueload(
          (photo === null) ? undefined : photo.thumb_url
        )

        const [show_photo, showPhoto] = useState(false)
        useEffect(() => {
          const handler = setTimeout(thunkify(showPhoto)(true), timeline['show_picture'])
          return () => clearTimeout(handler)
        }, [])

        const [removing, setRemoving] = useState(false)
        const [removed, setRemoved] = useState(false)
        const handleRemove = useCallback(() => {
          setRemoving(true)
          if (photo) {
            if (qq_num) {
              const t = timeout(1500)
              const canceling = cancelMySubmission({
                qq_num,
                photo_id: photo.id,
              })
              Promise.all([t, canceling]).then(() => {
                canceling.then(() => {
                  if (unmounted) {
                    _EVENT_.canceled.trigger(photo.id)
                  } else {
                    setRemoving(false)
                    setRemoved(true)
                    _EVENT_.canceled.trigger(photo.id)
                  }
                })
              }).catch(err => {
                if (unmounted) { return }
                setRemoving(false)
                alert(`取消投稿操作失败：${err}`)
              })
            }
          }
          let unmounted = false
          return () => { unmounted = true }
        }, [photo, qq_num])

        const confirm_node = useMemo(() => {
          let removing_node: ReactNode = null
          const removing_node_style: CSSProperties = {
            marginTop: '40px',
          }
          if (removed) {
            removing_node = <div style={removing_node_style}>
              <TextContentEffect
                textContent="你的投稿已撤回"
                showContentWaittime={0}
              />
            </div>
          } else if (removing) {
            removing_node = <div style={removing_node_style}><Loading /></div>
          }
          return (
            <div style={{ position: 'relative' }}>
              {removing_node ? removing_node : (
                <ScriptPlayerSelects
                  selects={selects}
                  waittime={timeline.select_waittime}
                  onClickSelect={i => {
                    if (i === 0) {
                      handleRemove()
                    } else {
                      changeScript(selects[i].next_script)
                    }
                  }}
                  changeScript={changeScript}
                />
              )}
            </div>
          )
        }, [changeScript, handleRemove, removed, removing, selects])

        const [remove_effect_played, setPlayed] = useState(false)
        useEffect(() => {
          if (photo && removed) {
            const targets = document.querySelectorAll('.disintegration-target')
            for (let i = 0; i < targets.length; ++i) {
              const $elm = targets[i] as any
              if ($elm.disintegrated) { return }
              $elm.disintegrated = true
              timeout(
                500 +
                textContentEffectTotalTime(0, '你的投稿已撤回')
              ).then(() => {
                disintegrate($elm).catch(err => {
                  console.warn('disintegrate', err)
                  AppCriticalError(`disintegrate error: ${err}`)
                }).finally(() => {
                  setTimeout(() => {
                    setPlayed(true)
                  }, 500)
                })
              })
            }
          }
        }, [photo, removed])

        const removed_selects = useMemo(() => [
          select('你干得好啊。', script('同装摄影大赛，来去自由！', [])),
          select_我说说的你怎么就当真了()
        ], [])

        return (
          <>
            <div>
              <TextContentEffect
                textContent="什么？！你想取消投稿？"
                showContentWaittime={timeline['什么？！你想取消投稿？']}
              />
            </div>
            <div>
              <TextContentEffect
                textContent="撤回没逼品"
                interval={500}
                hideClassName={s.CancelSubmissionEffectCharHide}
                showClassName={[s.CancelSubmissionEffectCharShow, delete_line ? s.DeleteLine : ''].join(' ')}
                showContentWaittime={timeline['撤回没逼品']}
              />
            </div>

            <div>
              <TextContentEffect
                textContent="额，好吧。可以取消的，你确定真的要这样做吗？"
                showContentWaittime={timeline['可以的']}
              />
            </div>

            <div style={{
              ...(show_photo ? {
                marginTop: '20px'
              } : {
                overflow: 'hidden',
                height: '0px'
              }),
            }}>
              {
                photo && (
                  <div className="disintegration-target">
                    <PreviewBox
                      previewURL={photo.thumb_url}
                      imageAppendClassName={ removed ? s.PhotoRemoving : '' }
                      height={320 / (photo.width / photo.height)}
                      isDragging={false}
                    />
                  </div>
                )
              }
            </div>

            {confirm_node}

            {
              remove_effect_played && (
                <ScriptPlayerSelects
                  selects={removed_selects}
                  onClickSelect={(i) => { changeScript(removed_selects[i].next_script) }}
                  changeScript={changeScript}
                  waittime={1000}
                />
              )
            }

            <style>{`

            `}</style>
          </>
        )
      },
    })
  }
  const select_我说说的你怎么就当真了 = () => select('我说说的你怎么就当真了？', componentScript([], ({ changeScript }) => {
    useEffect(() => {
      useSubmissionStore.setState({ photo: null })
    }, [])

    return (
      <>
        <RenderContent
          Content={script_PhotoCreateOrEditWithTitle('好吧，那你就再重新投稿咯', 'CREATE').Content}
          changeScript={changeScript}
          showContentWaittime={0}
        />
      </>
    )
  }))

  const select_我其实是想取消投稿 = select('我其实是想取消投稿......', script_撤回确认())

  const script_同装同装 = componentScript([], () => {
    return <>
      <img src={image_同装同装} style={{ height: '120px' }} />
    </>
  })

  const script_听说你在下周会来参加投票: Script = {
    ...script('听说你在下周会来参加投票', [
      select('是', script_同装同装),
      select('我只是凑巧路过......', script('额额额......', [])),
    ]),
    show_content_waittime: 500
  }

  // return script_撤回确认

  return (
    function initScript(): Script {
      async function updateMySubmission() {
        const { gallery_id, qq_num } = useSubmissionStore.getState()
        if ((gallery_id === null) || (qq_num === null)) {
          AppCriticalError(`gallery_id(${gallery_id}) 或者 qq_num${qq_num} 为 null`)
        } else {
          const my_submission = await getSubmissionByQQNum(gallery_id, qq_num)
          if (my_submission === null) {
            useSubmissionStore.setState({ photo: null })
          } else {
            useSubmissionStore.setState({
              photo: normal2InActive(my_submission)
            })
          }
          return my_submission
        }
      }

      return scriptAdvance({
        Content: '听说你要参加摄影大赛',
        show_content_waittime: 1000,
        show_select_timeout: 1000,
        selects: [
          select('是的吧我要参加', componentScript([], ({ changeScript }) => {
            return (
              <RequestInputQQNumber loginSuccess={async () => {
                const my_submission = await updateMySubmission()
                if (my_submission !== undefined) {
                  changeScript(
                    submissionCheckingScript()
                  )
                }
              }} />
            )
          })),
          select('否，我不想参加', script_听说你在下周会来参加投票),
          select('啊？我参加了啊', componentScript([], ({ changeScript }) => {
            const [show_input, showInput] = useState(false)
            const title = '不可能，别骗我了，你拿出证明啊'
            const title_waittime = 300
            useEffect(() => {
              const handler = setTimeout(() => {
                showInput(true)
              }, 300 + textContentEffectTotalTime(title_waittime, title))
              return () => clearTimeout(handler)
            }, [])
            return (
              <>
                <TextContentEffect textContent={title} showContentWaittime={title_waittime} />
                { show_input && (
                  <RequestInputQQNumber loginSuccess={async () => {
                    const my_submission = await updateMySubmission()
                    if (my_submission) {
                      changeScript(
                        iMistake()
                      )

                    } else if (my_submission === null) {
                      changeScript(
                        iamJoinAfter('你根本没有参加，骗我。')
                      )
                    }
                  }} />
                )}
              </>
            )
          }))
        ]
      })
    }
  )
}

export default () => <></>
