package k8s

var watchedReasons = map[string]bool{
  "CrashLoopBackOff":            true,
  "OOMKilled":                   true,
  "Error":                       true,
  "BackOff":                     true,
  "Failed":                      true,
  "FailedMount":                 true,
  "FailedScheduling":            true,
  "FailedCreatePodContainer":    true,
  "FailedCreatePodSandbox":      true,
  "ImagePullBackOff":            true,
  "ErrImagePull":                true,
  "ErrImageNeverPull":           true,
  "CreateContainerConfigError":  true,
  "CreateContainerError":        true,
  "RunContainerError":           true,
  "Killing":                     true,
  "Unhealthy":                   true,
  "Evicted":                     true,
  "NetworkNotReady":             true,
  "HostPortConflict":            true,
}
