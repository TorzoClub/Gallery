import React, { useEffect, useState } from 'react'
import { AppCriticalError } from 'App'
import { confirmQQNum, getSubmissionByQQNum } from 'api/member'

import { componentScript, script, select, Script, Select, Content, useSubmissionStore, jumpScript, _EVENT_ } from './'

import WaitingInputFrame from 'components/ConfirmQQ/WaitingInputFrame'
import { timeout } from 'new-vait'
import Loading from 'components/Loading'
import PhotoCreateOrEdit, { PreviewBox } from './PhotoCreateOrEdit'

import image_同装同装 from '../../assets/同装 同装.png'
import { Photo, PhotoInActive, PhotoNormal, cancelMySubmission } from 'api/photo'

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
      select('话说，我想修改一下投稿，可以吗？', script_当然可以修改),
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
        select('哦，我其实想修改的', script_当然可以修改),
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
          changeScript(script_感谢你的参与('CREATED', created_photo))
        }} />
      })
    }
  }

  const script_感谢你的参与 = (type: 'CREATED' | 'EDITED', photo: PhotoNormal) => {
    return componentScript([], ({ changeScript }) => {
      useEffect(() => {
        setTimeout(() => {
          if (type === 'CREATED') {
            _EVENT_.created.trigger({ ...photo, member: null, member_id: null })
          } else {
            _EVENT_.updated.trigger({ ...photo, member: null, member_id: null })
          }
        }, 1500)
      }, [])
      return <>
        感谢你的参与！
      </>
    })
  }

  const script_当然可以修改 = componentScript([], ({ changeScript }) => {
    return <>
      <div style={{ marginBottom: '20px' }}>{'当然可以！'}</div>
      <PhotoCreateOrEdit onUpdateDone={(edited_photo) => {
        changeScript(script_感谢你的参与('EDITED', edited_photo))
      }} />
    </>
  })

  const script_你的投稿已成功撤回 = (canceled_photo_id: PhotoInActive['id']) => {
    return script(() => {
      useEffect(() => {
        setTimeout(() => {
          _EVENT_.canceled.trigger(canceled_photo_id)
        }, 1500)
      }, [])
      return <>你的投稿已成功撤回</>
    }, [
      select('你干得好啊。', script('同装摄影大赛，来去自由！', [])),
      select('我说说的你怎么就当真了？', componentScript([], ({ changeScript }) => {
        useEffect(() => {
          useSubmissionStore.setState({ photo: null })
        }, [])

        useEffect(() => {
          const h = setTimeout(() => {
            changeScript(submissionCheckingScript())
          }, 2000)
          return () => clearTimeout(h)
        })
        return <>好吧，那你就再重新投稿咯</>
      }))
    ])
  }

  const script_取消投稿 = componentScript([], ({ changeScript }) => {
    const { photo, qq_num } = useSubmissionStore()
    const [ processing, setProcessing ] = useState(true)

    useEffect(() => {
      if (photo) {
        if (qq_num) {
          cancelMySubmission({
            qq_num,
            photo_id: photo.id,
          }).then(() => {
            changeScript(script_你的投稿已成功撤回(photo.id))
          }).catch(err => {
            alert(`取消投稿操作失败：${err}`)
          })
        }
      }
    }, [changeScript, photo, qq_num])

    return <>
      {processing ? <Loading /> : 'deleted'}
    </>
  })

  const select_我其实是想取消投稿 = select('我其实是想取消投稿……', componentScript(
    [
      select('是', script_取消投稿),
      select('否', script('你逗我玩是吧？', [
        select('我真的想参加', jumpScript(submissionCheckingScript, ['要做什么'])),
        select('我只是随便看看', script('呃呃呃……', []))
      ]))
    ],
    ({ changeScript }) => {
      return (
        <>'什么？！你想取消投稿？撤回没逼品！ 额，好吧，\n\n可以的，你真的要取消吗？'</>
      )
    },
  ))

  const script_同装同装 = componentScript([], () => {
    return <>
      <img src={image_同装同装} style={{ height: '120px' }} />
    </>
  })

  script('听说你在下周会来参加投票', [
    select('是', script_同装同装),
    select('我只是凑巧路过……', script('额额额……', [])),
  ])

  const script_听说你在下周会来参加投票 = script('听说你在下周会来参加投票', [
    select('是', script_同装同装),
    select('我只是凑巧路过……', script('额额额……', [])),
  ])

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
              photo: { ...my_submission, member: null, member_id: null }
            })
          }
          return my_submission
        }
      }

      return {
        Content: '听说你要参加摄影大赛',
        show_content_waittime: 750,
        show_select_timeout: 1000,
        selects: [
          {
            Content: '是的吧我要参加',
            next_script: {
              Content: ({ changeScript }) => <RequestInputQQNumber loginSuccess={async () => {
                const my_submission = await updateMySubmission()
                if (my_submission !== undefined) {
                  changeScript(
                    submissionCheckingScript()
                  )
                }
              }} />,
              show_select_timeout: 1000,
              selects: []
            }
          },
          {
            Content: '否，我不想参加',
            next_script: script_听说你在下周会来参加投票
          },
          {
            Content: '啊？我参加了啊',
            next_script: {
              Content: ({ changeScript }) => {
                return (
                  <>
                    <div style={{ textAlign: 'center' }}>不可能，别骗我了，你拿出证明啊</div>
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
                        // iamJoinAfter(')
                      }
                    }} />
                  </>
                )
              },
              show_select_timeout: 1000,
              selects: []
            }
          },
        ]
      }
    }
  )
}

export default () => <></>
